<script setup lang="ts">
import { Plus, Trash2 } from "@lucide/vue";
import { toast } from "#layers/base/app/components/ui/sonner";
import { complementGroupSchema } from "#shared/schemas/complement-group.schema";
import type { ComplementGroupDto } from "#shared/types/domain";

const props = defineProps<{
  group?: ComplementGroupDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useComplementGroupsStore();

const form = reactive({
  name: "",
  isRequired: false,
  minSelect: 0 as number | string,
  maxSelect: "" as number | string,
  sortOrder: 0,
  options: [] as { name: string; priceDelta: number | string }[],
});

const submitting = ref(false);
const errorMessage = ref("");

function resetForm() {
  const group = props.group;
  form.name = group?.name ?? "";
  form.isRequired = group?.isRequired ?? false;
  form.minSelect = group?.minSelect ?? 0;
  form.maxSelect = group?.maxSelect ?? "";
  form.sortOrder = group?.sortOrder ?? store.items.length;
  form.options = group?.options.length
    ? group.options.map((option) => ({ name: option.name, priceDelta: option.priceDelta }))
    : [{ name: "", priceDelta: 0 }];
  errorMessage.value = "";
}

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const isEditing = computed(() => Boolean(props.group));

function addOption() {
  form.options.push({ name: "", priceDelta: 0 });
}

function removeOption(index: number) {
  form.options.splice(index, 1);
}

async function onSubmit() {
  errorMessage.value = "";
  const parsed = complementGroupSchema.safeParse({
    ...form,
    maxSelect: form.maxSelect === "" ? null : form.maxSelect,
    options: form.options
      .filter((option) => option.name.trim() !== "")
      .map((option, index) => ({ ...option, sortOrder: index })),
  });
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? "Verifique os campos do formulário.";
    return;
  }

  submitting.value = true;
  try {
    if (props.group) {
      await store.update(props.group.id, parsed.data);
      toast.success("Grupo de complementos atualizado.");
    } else {
      await store.create(parsed.data);
      toast.success("Grupo de complementos criado.");
    }
    open.value = false;
  } catch (error) {
    errorMessage.value = getErrorMessage(error) ?? "Não foi possível salvar o grupo de complementos.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Editar grupo de complementos" : "Novo grupo de complementos" }}</DialogTitle>
        <DialogDescription>
          Grupos podem ser reaproveitados em vários produtos, como "Escolha o tamanho" ou "Adicionais".
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="group-name">Nome</Label>
          <Input id="group-name" v-model="form.name" required placeholder="Ex: Escolha o tamanho" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="group-min">Seleções mínimas</Label>
            <Input id="group-min" v-model="form.minSelect" type="number" min="0" step="1" />
          </div>
          <div class="space-y-1.5">
            <Label for="group-max">Seleções máximas (opcional)</Label>
            <Input id="group-max" v-model="form.maxSelect" type="number" min="0" step="1" />
          </div>
        </div>

        <div class="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p class="text-sm font-medium">Obrigatório</p>
            <p class="text-xs text-muted-foreground">O cliente precisa escolher pelo menos uma opção deste grupo.</p>
          </div>
          <Switch v-model="form.isRequired" />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Opções</Label>
            <Button type="button" variant="ghost" size="sm" class="gap-1" @click="addOption">
              <Plus class="size-4" />
              Adicionar opção
            </Button>
          </div>

          <div v-for="(option, index) in form.options" :key="index" class="flex gap-2">
            <Input v-model="option.name" placeholder="Ex: Grande" class="flex-1" />
            <Input v-model="option.priceDelta" type="number" min="0" step="0.01" placeholder="R$ 0,00" class="w-28" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover opção"
              :disabled="form.options.length <= 1"
              @click="removeOption(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="submit" :disabled="submitting">{{ submitting ? "Salvando..." : "Salvar" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
