<?php

declare(strict_types = 1);

namespace PhpstanDrupalPlayground\Tests;

use PHPUnit\Framework\TestCase;

final class AnalyzeTest extends TestCase
{

    /**
     * The analyze closure, loaded once and reused like a warm Lambda.
     *
     * @var \Closure
     */
    private static \Closure $analyze;

    public static function setUpBeforeClass(): void
    {
        self::$analyze = require dirname(__DIR__) . '/analyze.php';
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array{result: array<int, array<string, mixed>>, versions: array<string, string>}
     */
    private function analyze(string $code, array $overrides = []): array
    {
        return (self::$analyze)($overrides + [
            'code' => $code,
            'level' => '9',
            'strictRules' => false,
            'bleedingEdge' => false,
            'treatPhpDocTypesAsCertain' => true,
        ]);
    }

    public function testReportsDrupalAwareErrors(): void
    {
        $output = $this->analyze(<<<'PHP'
<?php

module_load_include('inc', 'foo', 'node.admin');
PHP);

        $identifiers = array_column($output['result'], 'identifier');
        self::assertContains('moduleLoadInclude.moduleNotFound', $identifiers);
        self::assertContains('function.notFound', $identifiers);
        foreach ($output['result'] as $error) {
            self::assertArrayHasKey('message', $error);
            self::assertArrayHasKey('line', $error);
            self::assertArrayHasKey('ignorable', $error);
        }
    }

    public function testReportsVersions(): void
    {
        $output = $this->analyze('<?php');

        self::assertSame([], $output['result']);
        self::assertMatchesRegularExpression('/^2\./', $output['versions']['phpstan']);
        self::assertMatchesRegularExpression('/^2\./', $output['versions']['phpstan-drupal']);
        self::assertMatchesRegularExpression('/^11\./', $output['versions']['drupal']);
    }

    public function testEntityStorageTypeInference(): void
    {
        $output = $this->analyze(<<<'PHP'
<?php

$node = \Drupal::entityTypeManager()->getStorage('node')->load(1);
echo $node->label();
PHP);

        self::assertCount(1, $output['result']);
        $error = $output['result'][0];
        self::assertSame('method.nonObject', $error['identifier']);
        self::assertStringContainsString('Drupal\node\Entity\Node|null', $error['message']);
        self::assertSame(4, $error['line']);
    }

    public function testStrictRulesToggle(): void
    {
        $code = <<<'PHP'
<?php

var_dump(1 == '1');
PHP;

        $identifiers = array_column($this->analyze($code)['result'], 'identifier');
        self::assertNotContains('equal.notAllowed', $identifiers);

        $strictIdentifiers = array_column($this->analyze($code, ['strictRules' => true])['result'], 'identifier');
        self::assertContains('equal.notAllowed', $strictIdentifiers);
    }

    public function testPhpVersionParameter(): void
    {
        $code = <<<'PHP'
<?php

enum Suit
{
    case Hearts;
}
PHP;

        self::assertSame([], $this->analyze($code, ['phpVersion' => 80300])['result']);

        $errors = $this->analyze($code, ['phpVersion' => 70400])['result'];
        self::assertNotSame([], $errors);
        self::assertSame('phpstan.parse', $errors[0]['identifier']);
    }

    public function testWarmInvocationsAreConsistent(): void
    {
        $code = <<<'PHP'
<?php

\Drupal::entityTypeManager()->getStorage('node')->load(1)?->label();
PHP;

        $first = $this->analyze($code);
        $second = $this->analyze($code);
        self::assertSame($first['result'], $second['result']);
    }

}
