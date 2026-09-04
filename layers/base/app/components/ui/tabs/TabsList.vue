<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsList, type TabsListProps, useForwardProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <TabsList
    v-bind="forwarded"
    :class="cn('inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', props.class)"
  >
    <slot />
  </TabsList>
</template>
