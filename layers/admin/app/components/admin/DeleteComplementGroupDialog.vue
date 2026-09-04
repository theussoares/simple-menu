<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import type { ComplementGroupDto } from "#shared/types/domain";

const props = defineProps<{
  group: ComplementGroupDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useComplementGroupsStore();
const productsStore = useProductsStore();
const removing = ref(false);

const affectedProductsCount = computed(() => {
  if (!props.group) return 0;
  return productsStore.items.filter((product) => product.complementGroupIds.includes(props.group!.id)).length;
});

async function onConfirm() {
  if (!props.group) return;
  removing.value = true;
  try {
    await store.remove(props.group.id);
    toast.success("Grupo de complementos excluído.");
    open.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível excluir o grupo de complementos.");
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir grupo de complementos?</AlertDialogTitle>
        <AlertDialogDescription>
          Tem certeza que deseja excluir <strong>{{ group?.name }}</strong>?
          <template v-if="affectedProductsCount > 0">
            {{ affectedProductsCount }} {{ affectedProductsCount === 1 ? "produto perderá" : "produtos perderão" }} este complemento.
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
