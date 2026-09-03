<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { DialogTitle, type DialogTitleProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DialogTitle v-bind="delegatedProps" :class="cn('text-lg font-semibold leading-none', props.class)">
    <slot />
  </DialogTitle>
</template>
