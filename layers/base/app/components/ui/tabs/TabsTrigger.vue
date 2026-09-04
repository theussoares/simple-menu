<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,box-shadow] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm disabled:pointer-events-none disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
