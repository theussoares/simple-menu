<script setup lang="ts">
import { toast } from '#layers/base/app/components/ui/sonner'
import type { ProductDto } from '#shared/types/domain'

const props = defineProps<{
  product: ProductDto | null
}>()

const open = defineModel<boolean>({ default: false })

const store = useProductsStore()
const removing = ref(false)

async function onConfirm() {
  if (!props.product) return
  removing.value = true
  try {
    await store.remove(props.product.id)
    toast.success('Produto excluído.')
    open.value = false
  }
  catch (error) {
    toast.error(getErrorMessage(error) ?? 'Não foi possível excluir o produto.')
  }
  finally {
    removing.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
        <AlertDialogDescription>
          Tem certeza que deseja excluir <strong>{{ product?.name }}</strong>?
          Essa ação não pode ser desfeita.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="removing">Cancelar</AlertDialogCancel>
        <AlertDialogAction :disabled="removing" @click.prevent="onConfirm">
          {{ removing ? 'Excluindo...' : 'Excluir' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
