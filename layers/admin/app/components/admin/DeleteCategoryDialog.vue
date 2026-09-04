<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import type { CategoryDto } from "#shared/types/domain";

const props = defineProps<{
  category: CategoryDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useCategoriesStore();
const productsStore = useProductsStore();
const removing = ref(false);

const affectedProductsCount = computed(() => {
  if (!props.category) return 0;
  return productsStore.items.filter((product) => product.categoryId === props.category?.id).length;
});

async function onConfirm() {
  if (!props.category) return;
  removing.value = true;
  try {
    await store.remove(props.category.id);
    productsStore.items.forEach((product) => {
      if (product.categoryId === props.category?.id) product.categoryId = null;
    });
    toast.success("Categoria excluída.");
    open.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível excluir a categoria.");
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
        <AlertDialogDescription>
          Tem certeza que deseja excluir <strong>{{ category?.name }}</strong>?
          <template v-if="affectedProductsCount > 0">
            {{ affectedProductsCount }} {{ affectedProductsCount === 1 ? "produto ficará" : "produtos ficarão" }} sem categoria.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="removing">Cancelar</AlertDialogCancel>
        <AlertDialogAction :disabled="removing" @click.prevent="onConfirm">
          {{ removing ? "Excluindo..." : "Excluir" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
