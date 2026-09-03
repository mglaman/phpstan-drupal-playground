// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { EditorView } from '@codemirror/view';
import App from '../src/App.svelte';
import { sampleCode } from '../src/sample.js';

const sharedId = 'e8500ee1-9159-4fea-a49b-27a46112101d';
const sharedCode = '<?php\n\necho "shared";';
const sharedResult = {
    id: sharedId,
    code: sharedCode,
    level: '5',
    strictRules: true,
    bleedingEdge: false,
    treatPhpDocTypesAsCertain: true,
    tabs: [{title: 'PHP 8.3', errors: [{line: 3, message: 'Shared error', ignorable: true}]}],
    versions: {phpstan: '2.0.0', 'phpstan-drupal': '2.0.0', drupal: '11.0.0'},
};

const jsonResponse = (body) => ({ok: true, json: () => Promise.resolve(body)});

const editorCode = () => {
    const content = document.querySelector('.cm-content');
    return content === null ? null : EditorView.findFromDOM(content).state.doc.toString();
};

describe('App', () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        window.history.replaceState({}, '', '/');
    });

    it('renders the sample and its preloaded result on the home page', async () => {
        render(App);
        await tick();

        expect(editorCode()).toBe(sampleCode);
        expect(screen.queryByText('Loading shared result…')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not show the sample while a shared result loads', async () => {
        // Regression: the shared result was fetched in onMount, so the page
        // first painted the sample code and result, then swapped them out.
        window.history.replaceState({}, '', `/r/${sharedId}`);
        let resolveFetch;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

        render(App);
        await tick();

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/result?id=${sharedId}`), expect.anything());
        expect(screen.getByText('Loading shared result…')).toBeTruthy();
        expect(document.body.textContent).not.toContain('entityQuery');
        expect(document.body.textContent).not.toContain('Found');

        resolveFetch(jsonResponse(sharedResult));
        await waitFor(() => expect(editorCode()).toBe(sharedCode));

        expect(screen.queryByText('Loading shared result…')).toBeNull();
        expect(screen.getByText('Shared error')).toBeTruthy();
        expect(screen.getByRole('combobox', {name: ''}).value).toBe('5');
        expect(screen.getByLabelText('Strict rules').checked).toBe(true);
    });

    it('falls back to the sample with a message when the shared result cannot load', async () => {
        window.history.replaceState({}, '', `/r/${sharedId}`);
        fetchMock.mockResolvedValue({ok: false, status: 500, json: () => Promise.reject(new Error('no body'))});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        render(App);
        await waitFor(() => expect(screen.getByText(/could not be loaded/)).toBeTruthy());

        expect(editorCode()).toBe(sampleCode);
        expect(screen.queryByText('Loading shared result…')).toBeNull();
    });
});
