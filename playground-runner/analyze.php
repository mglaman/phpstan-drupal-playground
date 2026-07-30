<?php

declare(strict_types = 1);

use Composer\InstalledVersions;
use Nette\Neon\Neon;
use PHPStan\Analyser\Analyser;
use PHPStan\Analyser\AnalyserResultFinalizer;
use PHPStan\DependencyInjection\ContainerFactory;
use Symfony\Component\Console\Formatter\OutputFormatter;

require __DIR__.'/vendor/autoload.php';

error_reporting(E_ALL);
ini_set('display_errors', '1');

\Sentry\init([
    'dsn' => 'https://eb2a3a58974934df33e68af214e70607@o4505060230627328.ingest.sentry.io/4506276580818944',
    'traces_sample_rate' => 1.0,
    'profiles_sample_rate' => 1.0,
]);

$phpstanVersion = InstalledVersions::getPrettyVersion('phpstan/phpstan');
$phpstanDrupalVersion = InstalledVersions::getPrettyVersion('mglaman/phpstan-drupal');
// @note: we use the constant here, because analysis fails for _some reason_ unless the class is loaded ahead of time.
$drupalCoreVersion = \Drupal::VERSION;

function clearTemp($tmpDir): void
{
	$files = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator($tmpDir, RecursiveDirectoryIterator::SKIP_DOTS),
		RecursiveIteratorIterator::CHILD_FIRST
	);

	foreach ($files as $fileinfo) {
		$todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
		$todo($fileinfo->getRealPath());
	}
}

return function(array $event) use ($phpstanVersion, $phpstanDrupalVersion, $drupalCoreVersion) {
    $tmpDir = sys_get_temp_dir() . '/phpstan-runner';
    if (!is_dir($tmpDir)) {
        mkdir($tmpDir);
    }
	clearTemp($tmpDir);
    $debug = $event['debug'] ?? false;
	$code = $event['code'];
	$level = $event['level'];
	$codePath = sys_get_temp_dir() . '/phpstan-runner/tmp.php';
	file_put_contents($codePath, $code);

	$rootDir = __DIR__;
    $configFiles = [
		$rootDir . '/playground.neon',
        $rootDir . '/vendor/mglaman/phpstan-drupal/extension.neon',
        $rootDir . '/vendor/mglaman/phpstan-drupal/rules.neon',
        $rootDir . '/vendor/phpstan/phpstan-deprecation-rules/rules.neon',
	];
	foreach ([
		'strictRules' => $rootDir . '/vendor/phpstan/phpstan-strict-rules/rules.neon',
		'bleedingEdge' => 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/conf/bleedingEdge.neon',
	] as $key => $file) {
		if (!isset($event[$key]) || !$event[$key]) {
			continue;
		}

		$configFiles[] = $file;
	}
	$neon = Neon::encode([
		'includes' => $configFiles,
		'parameters' => [
			'inferPrivatePropertyTypeFromConstructor' => true,
			'treatPhpDocTypesAsCertain' => $event['treatPhpDocTypesAsCertain'] ?? true,
			'phpVersion' => $event['phpVersion'] ?? 80300,
		],
		'services' => [
			'currentPhpVersionSimpleParser!' => [
				'factory' => '@currentPhpVersionRichParser',
			],
		],
	]);
	// The compiled DI container class is keyed by the config file path, not
	// its content. A constant filename makes warm invocations reuse the first
	// container and silently ignore config changes (strictRules, phpVersion),
	// so the path must vary with the content.
	$finalConfigFile = $tmpDir . '/run-phpstan-' . md5($neon) . '.neon';
	file_put_contents($finalConfigFile, $neon);

	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/ReflectionUnionType.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/ReflectionIntersectionType.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/ReflectionAttribute.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/' . (PHP_VERSION_ID < 80500 ? 'Attribute84.php' : 'Attribute85.php');
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/Enum/UnitEnum.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/Enum/BackedEnum.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/Enum/ReflectionEnum.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/Enum/ReflectionEnumUnitCase.php';
	require_once 'phar://' . $rootDir . '/vendor/phpstan/phpstan/phpstan.phar/stubs/runtime/Enum/ReflectionEnumBackedCase.php';

	$containerFactory = new ContainerFactory($tmpDir);
	$container = $containerFactory->create($tmpDir, [sprintf('%s/config.level%s.neon', $containerFactory->getConfigDirectory(), $level), $finalConfigFile], [$codePath]);

    // Note: this is the big change from the parent script in phpstan-src.
    foreach ($container->getParameter('bootstrapFiles') as $bootstrapFileFromArray) {
        try {
            (static function (string $bootstrapFileFromArray) use ($container): void {
                require_once $bootstrapFileFromArray;
            })($bootstrapFileFromArray);
        } catch (Throwable $e) {
            $error = sprintf('%s thrown in %s on line %d while loading bootstrap file %s: %s', get_class($e), $e->getFile(), $e->getLine(), $bootstrapFileFromArray, $e->getMessage());
            return [
                'result' => [$error],
                'versions' => [
                    'phpstan' => $phpstanVersion,
                    'phpstan-drupal' => $phpstanDrupalVersion,
                    'drupal' => $drupalCoreVersion,
                ],
                'request' => $event
            ];
        }
    }

	/** @var Analyser $analyser */
	$analyser = $container->getByType(Analyser::class);
	$analyserResult = $analyser->analyse([$codePath], null, null, $debug, [$codePath]);

	/** @var AnalyserResultFinalizer $analyserResultFinalizer */
	$analyserResultFinalizer = $container->getByType(AnalyserResultFinalizer::class);
	$results = $analyserResultFinalizer->finalize($analyserResult, true, $debug)->getErrors();

	error_clear_last();

	$errors = [];
	$tipFormatter = new OutputFormatter(false);
	foreach ($results as $result) {
		$error = [
			'message' => $result->getMessage(),
			'line' => $result->getLine(),
			'ignorable' => $result->canBeIgnored(),
		];
		if ($result->getTip() !== null) {
			$error['tip'] = $tipFormatter->format($result->getTip());
		}
		if ($result->getIdentifier() !== null) {
			$error['identifier'] = $result->getIdentifier();
		}
		$errors[] = $error;
	}

	return ['result' => $errors, 'versions' => [
        'phpstan' => $phpstanVersion,
        'phpstan-drupal' => $phpstanDrupalVersion,
        'drupal' => $drupalCoreVersion,
    ]];
};
