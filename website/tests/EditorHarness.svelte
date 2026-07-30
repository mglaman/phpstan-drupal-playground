<script>
    import Editor from '../src/Editor/Editor.svelte';

    export let code = '<?php\n\necho 1;';
    export let errors = [];
</script>

<Editor bind:code errors={errors} />
<pre data-testid="bound-code">{code}</pre>
