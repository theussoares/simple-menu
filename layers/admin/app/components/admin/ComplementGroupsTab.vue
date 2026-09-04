<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import type { ComplementGroupDto } from '#shared/types/domain'

const store = useComplementGroupsStore()

const formOpen = ref(false)
const deleteOpen = ref(false)
const activeGroup = ref<ComplementGroupDto | null>(null)

function openCreate() {
  activeGroup.value = null
  formOpen.value = true
}

function openEdit(group: ComplementGroupDto) {
  activeGroup.value = group
  formOpen.value = true
}

function openDelete(group: ComplementGroupDto) {
  activeGroup.value = group
  deleteOpen.value = true
}

function selectSummary(group: ComplementGroupDto) {
  if (group.maxSelect === null) return `mín. ${group.minSelect}`
  return `${group.minSelect}–${group.maxSelect}`
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">Grupos podem ser reaproveitados em vários produtos.</p>
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        Novo grupo
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="store.items.length === 0" class="flex flex-col items-center gap-3 p-12 text-center">
          <p class="text-sm font-medium">Nenhum grupo de complementos cadastrado ainda</p>
          <Button class="gap-2" @click="openCreate">
            <Plus class="size-4" />
            Novo grupo
          </Button>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead>Seleções</TableHead>
              <TableHead>Opções</TableHead>
              <TableHead class="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="group in store.items" :key="group.id">
              <TableCell class="font-medium">{{ group.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ group.isRequired ? "Sim" : "Não" }}</TableCell>
              <TableCell class="text-muted-foreground">{{ selectSummary(group) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ group.options.length }}</TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" @click="openEdit(group)">
                    <Pencil class="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" @click="openDelete(group)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <ComplementGroupFormDialog v-model="formOpen" :group="activeGroup" />
    <DeleteComplementGroupDialog v-model="deleteOpen" :group="activeGroup" />
  </div>
</template>
