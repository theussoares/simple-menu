<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { AlertDialogAction, type AlertDialogActionProps } from 'reka-ui'
import { buttonVariants } from '#layers/base/app/components/ui/button'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<AlertDialogActionProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <AlertDialogAction v-bind="delegatedProps" :class="cn(buttonVariants({ variant: 'destructive' }), props.class)">
    <slot />
  </AlertDialogAction>
</template>
