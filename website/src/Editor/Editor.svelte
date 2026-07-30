<script>
    import {onMount} from "svelte";
    import {createEditor} from "./editor.js";
    import {errorsCompartment, errorsFacet, updateErrorsEffect} from "./errors";

    let editor, editorMount;
    export let code = '';
    export let errors = []

    // Guard against the editor's own change callback: without it, every
    // keystroke echoes back through the code prop and replaces the whole
    // document mid-typing.
    $: if (editor && code !== editor.state.doc.toString()) {
        editor.dispatch({
            changes: {
                from: 0,
                to: editor.state.doc.length,
                insert: code
            },
        })
    }

    $: if (editor) {
        editor.dispatch({
            effects: [
                errorsCompartment.reconfigure(errorsFacet.of(errors)),
                updateErrorsEffect.of(true),
            ],
        })
    }

    onMount(() => {
        editor = createEditor(editorMount, code, errors, update => code = update)
    })
</script>
<div>
    <div bind:this={editorMount}></div>
    {#if !editor}
        <textarea bind:value={code} rows="10" name="code" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-light-navy-blue sm:text-sm sm:leading-6"></textarea>
    {/if}
</div>
