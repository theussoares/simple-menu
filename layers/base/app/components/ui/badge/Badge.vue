<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { type BadgeVariants, badgeVariants } from '.'
import { cn } from '#layers/base/app/lib/utils'

interface Props extends PrimitiveProps {
  variant?: BadgeVariants['variant']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'span',
})
</script>

<template>
  <Primitive :as="as" :as-child="asChild" :class="cn(badgeVariants({ variant }), props.class)">
    <slot />
  </Primitive>
</template>
