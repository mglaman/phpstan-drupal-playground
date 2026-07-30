import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { buildErrorLines } from '../src/Editor/errors.js';

const doc = EditorState.create({doc: '<?php\n\nmodule_load_include(\'inc\', \'foo\', \'node.admin\');\n'}).doc;

const decorationClasses = (decorations) => {
    const classes = [];
    const cursor = decorations.iter();
    while (cursor.value !== null) {
        classes.push(cursor.value.spec.class);
        cursor.next();
    }
    return classes;
};

describe('buildErrorLines', () => {
    it('tolerates undefined errors', () => {
        // Regression: clicking Analyse passed undefined into the editor and
        // "errors is not iterable" wedged the whole UI mid-render.
        expect(() => buildErrorLines(doc, undefined)).not.toThrow();
        expect(buildErrorLines(doc, undefined).size).toBe(0);
    });

    it('decorates error lines', () => {
        const decorations = buildErrorLines(doc, [
            {line: 3, message: 'Function module_load_include not found.'},
        ]);

        expect(decorations.size).toBe(1);
        expect(decorationClasses(decorations)).toEqual(['bg-red-200/50']);
    });

    it('decorates playground tips differently from errors', () => {
        const decorations = buildErrorLines(doc, [
            {line: 1, message: 'Tip', identifier: 'phpstanPlayground.tip'},
            {line: 3, message: 'Error', identifier: 'function.notFound'},
        ]);

        expect(decorationClasses(decorations)).toEqual(['bg-yellow-200/50', 'bg-red-200/50']);
    });

    it('ignores lines outside the document', () => {
        const decorations = buildErrorLines(doc, [
            {line: 0, message: 'No line'},
            {line: -1, message: 'Negative'},
            {line: 99, message: 'Beyond the document'},
        ]);

        expect(decorations.size).toBe(0);
    });
});
