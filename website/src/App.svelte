<script>
    import {onMount} from "svelte";
    import Editor from "./Editor/Editor.svelte";
    import {apiUrl, sampleCode} from "./sample.js";
    import sampleResult from "./sample-result.json";

    onMount(() => {
        const resultMatch = window.location.pathname.match(/^\/r\/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$/i);
        if (resultMatch !== null) {
            fetchResult(resultMatch[1])
        }
    })

    const data = {
        code: sampleCode,
        level: '9',
        strictRules: false,
        bleedingEdge: false,
        treatPhpDocTypesAsCertain: true
    };
    let processing = false;
    let result = sampleResult;
    async function fetchResult(id) {
        result = null;
        processing = true;
        try {
            const response = await fetch(`${apiUrl}/result?id=${id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            result = await response.json();
            data.code = result.code;
            data.level = result.level;
            data.strictRules = result.strictRules;
            data.bleedingEdge = result.bleedingEdge;
            data.treatPhpDocTypesAsCertain = result.treatPhpDocTypesAsCertain;
        } catch (error) {
            console.error(error);
        } finally {
            processing = false;
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
            <p class="my-4">Try out PHPStan with phpstan-drupal and all of its features here in the editor. <a href="https://phpstan.org/" class="hover:no-underline underline">Learn more about PHPStan »</a></p>
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
                        <svg aria-hidden="true" class="text-gray-200 animate-spin dark:text-gray-600 fill-blue-700" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
                        </svg>
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
        </div>
    </main>
</div>
