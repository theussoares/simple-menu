<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import { categorySchema } from "#shared/schemas/category.schema";
import type { CategoryDto } from "#shared/types/domain";

const props = defineProps<{
  category?: CategoryDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useCategoriesStore();

const form = reactive({
  name: "",
  sortOrder: 0,
});

const submitting = ref(false);
const errorMessage = ref("");

function resetForm() {
  form.name = props.category?.name ?? "";
  form.sortOrder = props.category?.sortOrder ?? store.items.length;
  errorMessage.value = "";
}

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const isEditing = computed(() => Boolean(props.category));

async function onSubmit() {
  errorMessage.value = "";
  const parsed = categorySchema.safeParse(form);
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? "Verifique os campos.";
    return;
  }

  submitting.value = true;
  try {
    if (props.category) {
      await store.update(props.category.id, parsed.data);
      toast.success("Categoria atualizada.");
    } else {
      await store.create(parsed.data);
      toast.success("Categoria criada.");
    }
    open.value = false;
  } catch (error) {
    errorMessage.value = getErrorMessage(error) ?? "Não foi possível salvar a categoria.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Editar categoria" : "Nova categoria" }}</DialogTitle>
        <DialogDescription>Categorias organizam os produtos no seu cardápio.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="category-name">Nome</Label>
          <Input id="category-name" v-model="form.name" required placeholder="Ex: Lanches" />
        </div>

        <div class="space-y-1.5">
          <Label for="category-sort-order">Ordem de exibição</Label>
          <Input id="category-sort-order" v-model="form.sortOrder" type="number" min="0" step="1" />
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="submit" :disabled="submitting">{{ submitting ? "Salvando..." : "Salvar" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
