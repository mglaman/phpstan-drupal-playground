<script>
    import {onMount} from "svelte";
    import Editor from "./Editor/Editor.svelte";
    import Spinner from "./Spinner.svelte";
    import {apiUrl, sampleCode} from "./sample.js";
    import sampleResult from "./sample-result.json";

    // Resolve the shared result before the first render. Deciding this in
    // onMount painted the sample code and result first, then swapped them
    // out once the fetch finished.
    const sharedResultId = matchSharedResultId(window.location.pathname);

    const data = {
        code: sharedResultId ? '' : sampleCode,
        level: '9',
        strictRules: false,
        bleedingEdge: false,
        treatPhpDocTypesAsCertain: true
    };
    let processing = false;
    let loadingSharedResult = sharedResultId !== null;
    let sharedResultError = false;
    let result = sharedResultId ? null : sampleResult;

    onMount(() => {
        if (sharedResultId !== null) {
            fetchResult(sharedResultId)
        }
    })

    function matchSharedResultId(pathname) {
        const match = pathname.match(/^\/r\/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$/i);
        return match === null ? null : match[1];
    }

    async function fetchResult(id) {
        try {
            const response = await fetch(`${apiUrl}/result?id=${id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Shared result request failed with HTTP ${response.status}`);
            }
            result = await response.json();
            data.code = result.code;
            data.level = result.level;
            data.strictRules = result.strictRules;
            data.bleedingEdge = result.bleedingEdge;
            data.treatPhpDocTypesAsCertain = result.treatPhpDocTypesAsCertain;
        } catch (error) {
            console.error(error);
            sharedResultError = true;
            data.code = sampleCode;
            result = sampleResult;
        } finally {
            loadingSharedResult = false;
        }
    }
    async function analyse (event) {
        event.preventDefault();
        await doAnalyse(false);
    }

    async function doAnalyse(saveResult) {
        result = null;
        processing = true;
        if (typeof window.fathom !== 'undefined') {
            window.fathom.trackEvent('analyse code');
        }
        try {
            const response = await fetch(`${apiUrl}/analyse`, {
                method: 'POST',
                body: JSON.stringify({
                    ...data,
                    saveResult
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            result = await response.json();
        } catch (error) {
            console.error(error);
        } finally {
            processing = false;
        }
    }

    async function share() {
        const id = result?.id;
        if (!id) {
            await doAnalyse(true);
            window.history.replaceState({}, '', '/r/' + result.id);
        }
        if (typeof window.navigator.share !== 'undefined') {
            await window.navigator.share({url: window.location.href});
        } else if (typeof window.navigator.clipboard !== 'undefined') {
            await window.navigator.clipboard.writeText(window.location.href);
        }
        if (typeof window.fathom !== 'undefined') {
            window.fathom.trackEvent('shared result');
        }
    }
</script>
<svelte:head>
    <!-- Fathom - beautiful, simple website analytics -->
    <script src="https://cdn.usefathom.com/script.js" data-spa="auto" data-site="JQIHBWMK" defer></script>
    <!-- / Fathom -->
</svelte:head>
<div class="p-2 md:p-4 lg:py-8 lg:px-0">
    <main class="max-w-5xl md:px-6 mx-auto bg-white rounded-lg">
        <div class="p-4 md:p-6 lg:p-8">
            <div class="flex flex-row items-center">
                <h1 class="font-bold md:text-4xl sm:text-5xl text-4xl text-gray-900 tracking-tight">PHPStan Drupal Extension Playground</h1>
                <a target="_blank" href="https://github.com/mglaman/phpstan-drupal" class="border-b-2 border-transparent duration-150 ease-in-out focus:outline-none focus:text-gray-700 font-medium hover:text-gray-700 leading-5 ml-4 pt-1 px-1 text-gray-500 text-md transition" rel="noopener noreferrer">
                    <svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                        <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
                    </svg>
                </a>
            </div>
            <p class="my-4">Try out PHPStan with phpstan-drupal and all of its features here in the editor. <a href="https://phpstan.org/" class="hover:no-underline underline">Learn more about PHPStan »</a> Using an agent or a script? <a href="/llms.txt" class="hover:no-underline underline">Read the API notes</a>.</p>
            {#if loadingSharedResult}
                <div class="flex flex-col items-center py-12 text-gray-500">
                    <div class="w-12 h-12" role="status">
                        <Spinner />
                    </div>
                    <p class="mt-4">Loading shared result…</p>
                </div>
            {:else}
                {#if sharedResultError}
                    <div class="bg-red-100 mb-4 px-4 py-3 rounded-lg text-red-900" role="alert">
                        The shared result could not be loaded. It may have expired or the link may be wrong. The default sample is shown instead.
                    </div>
                {/if}
                <form class="space-y-4" on:submit={analyse}>
                    <Editor bind:code={data.code} errors={result?.tabs?.[0]?.errors ?? []} />
                    <details class="border border-gray-300 rounded-md p-2">
                        <summary class="text-sm">Advanced options</summary>
                        <div class="flex flex-col items-center md:flex-row mt-4 space-x-6">
                            <label class="inline-flex items-center md:mt-0 mt-4">
                                <input type="checkbox" name="strictRules" bind:checked={data.strictRules} class="border-gray-300 rounded">
                                <span class="ml-2">Strict rules</span>
                            </label>
                            <label class="inline-flex items-center md:mt-0 mt-4">
                                <input type="checkbox" name="bleedingEdge" bind:checked={data.bleedingEdge} class="border-gray-300 rounded">
                                <span class="ml-2">Bleeding edge</span>
                            </label>
                            <label class="inline-flex items-center md:mt-0 mt-4">
                                <input type="checkbox" name="treatPhpDocTypesAsCertain" bind:checked={data.treatPhpDocTypesAsCertain} class="border-gray-300 rounded">
                                <span class="ml-2">Treat PHPDoc types as certain</span>
                            </label>
                        </div>
                    </details>
                    <div class="flex flex-col space-y-2 md:items-center md:flex-row mt-4 md:space-x-4 md:space-y-0">
                        <select name="level" bind:value={data.level} class="block border border-gray-300 md:mt-0 md:mx-0 mt-4 rounded-md">
                            <option value="0">Level 0</option>
                            <option value="1">Level 1</option>
                            <option value="2">Level 2</option>
                            <option value="3">Level 3</option>
                            <option value="4">Level 4</option>
                            <option value="5">Level 5</option>
                            <option value="6">Level 6</option>
                            <option value="7">Level 7</option>
                            <option value="8">Level 8</option>
                            <option value="9">Level 9</option>
                        </select>
                        <button disabled={processing} class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" type="submit">Analyse</button>
                        <div class="hidden md:block flex-grow"></div>
                        <button on:click={share} type="button" class="bg-gray-100 border border-gray-300 flex-grow font-medium h-10 hover:bg-gray-200 inline-flex items-center justify-center leading-4 md:flex-grow-0 md:w-32 px-2.5 py-3 rounded-lg text-md w-auto">
                            <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" class="h-6 w-6"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                            <span class="ml-2">Share</span>
                        </button>
                    </div>
                </form>
                {#if processing}
                    <div class="m-auto w-12 h-12 mt-8">
                        <div role="status">
                            <Spinner />
                            <span class="sr-only">Loading...</span>
                        </div>
                    </div>
                {/if}
                <div class="pt-4">
                    {#each result?.tabs || [] as tab}
                        {#if tab.errors.length > 0}
                            <div class="flex items-stretch md:mx-0">
                                <span class="bg-red-100 flex-grow font-medium h-12 inline-flex items-center justify-center leading-4 md:flex-grow-0 mt-4 px-4 py-3 rounded-lg text-lg text-red-900" data-bind="text: errorsText">
                                    Found {tab.errors.length} errors
                                </span>
                            </div>
                            <table class="mt-8 w-full">
                                <thead>
                                    <tr>
                                        <th class="bg-gray-50 border-b border-gray-200 font-medium leading-4 px-6 py-3 text-base text-gray-500 text-left tracking-wider"> Line </th>
                                        <th class="bg-gray-50 border-b border-gray-200 font-medium leading-4 px-6 py-3 text-base text-gray-500 text-left tracking-wider"> Error </th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white">
                                {#each tab.errors as error}
                                    <tr>
                                        <td class="border-b border-gray-200 font-medium leading-5 px-6 py-4 text-base text-gray-500">
                                            {error.line}
                                        </td>
                                        <td class="border-b border-gray-200 font-medium leading-5 px-6 py-4 text-base text-gray-500">
                                            <div class="flex flex-col md:flex-row md:items-center">
                                                <div class="flex-shrink">
                                                    <div>{error.message}</div>
                                                    {#if error.tip}
                                                        <div>{error.tip}</div>
                                                    {/if}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                                </tbody>
                            </table>
                        {/if}
                    {/each}
                    {#if result?.versions}
                        <p class="mt-6 text-sm text-gray-500">
                            PHPStan {result.versions.phpstan}
                            · <a href="https://github.com/mglaman/phpstan-drupal" class="underline hover:no-underline">phpstan-drupal</a> {result.versions['phpstan-drupal']}
                            · Drupal {result.versions.drupal}
                        </p>
                    {/if}
                </div>
            {/if}
        </div>
    </main>
</div>
