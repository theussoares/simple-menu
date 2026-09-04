<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsContent, type TabsContentProps, useForwardProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <TabsContent v-bind="forwarded" :class="cn('mt-4 focus-visible:outline-none', props.class)">
    <slot />
  </TabsContent>
</template>
