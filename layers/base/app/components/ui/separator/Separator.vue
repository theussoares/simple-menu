<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { Separator, type SeparatorProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = withDefaults(defineProps<SeparatorProps & { class?: HTMLAttributes['class'] }>(), {
  orientation: 'horizontal',
})
</script>

<template>
  <Separator
    :class="
      cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        props.class,
      )
    "
    v-bind="$attrs"
    :orientation="orientation"
  />
</template>
