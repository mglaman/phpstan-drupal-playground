// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { EditorView } from '@codemirror/view';
import EditorHarness from './EditorHarness.svelte';

const renderEditor = async (props = {}) => {
    const rendered = render(EditorHarness, {props});
    await tick();
    const content = document.querySelector('.cm-content');
    expect(content).not.toBeNull();
    return {...rendered, view: EditorView.findFromDOM(content)};
};

describe('Editor', () => {
    afterEach(cleanup);

    it('renders the initial code', async () => {
        const {view} = await renderEditor();

        expect(view.state.doc.toString()).toBe('<?php\n\necho 1;');
    });

    it('propagates editor edits to the bound code prop', async () => {
        // Regression: the code prop was one-way, so edits never reached
        // data.code and Analyse kept re-posting the original sample.
        const {view} = await renderEditor();

        view.dispatch({
            changes: {from: view.state.doc.length, insert: '\necho 2;'},
        });
        await tick();

        expect(screen.getByTestId('bound-code').textContent).toBe('<?php\n\necho 1;\necho 2;');
    });

    it('replaces the document when the prop changes from outside', async () => {
        const {view, rerender} = await renderEditor();

        await rerender({code: '<?php\n\necho 3;'});
        await tick();

        expect(view.state.doc.toString()).toBe('<?php\n\necho 3;');
    });

    it('keeps the cursor in place while typing', async () => {
        // The reactive block used to replace the whole document on every
        // keystroke once the prop echoed back through the binding.
        const {view} = await renderEditor();

        view.dispatch({selection: {anchor: 7}});
        view.dispatch(view.state.replaceSelection('$'));
        await tick();

        expect(view.state.doc.toString()).toBe('<?php\n\n$echo 1;');
        expect(view.state.selection.main.head).toBe(8);
    });
});
