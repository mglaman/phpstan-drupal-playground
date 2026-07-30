export const apiUrl = 'https://gkyhj54sul.execute-api.us-east-1.amazonaws.com/prod';

export const sampleCode = `<?php\n\n$nids = \\Drupal::entityQuery('node')\n  ->condition('status', 1)\n  ->execute();\n\n$node = \\Drupal::entityTypeManager()->getStorage('node')->load(1);\necho $node->label();`;

export const sampleRequest = {
    code: sampleCode,
    level: '9',
    strictRules: false,
    bleedingEdge: false,
    treatPhpDocTypesAsCertain: true,
    saveResult: true,
};
