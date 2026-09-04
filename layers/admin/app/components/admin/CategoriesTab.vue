<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import type { CategoryDto } from '#shared/types/domain'

const store = useCategoriesStore()

const formOpen = ref(false)
const deleteOpen = ref(false)
const activeCategory = ref<CategoryDto | null>(null)

function openCreate() {
  activeCategory.value = null
  formOpen.value = true
}

function openEdit(category: CategoryDto) {
  activeCategory.value = category
  formOpen.value = true
}

function openDelete(category: CategoryDto) {
  activeCategory.value = category
  deleteOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">Organize os produtos do seu cardápio em categorias.</p>
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        Nova categoria
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="store.items.length === 0" class="flex flex-col items-center gap-3 p-12 text-center">
          <p class="text-sm font-medium">Nenhuma categoria cadastrada ainda</p>
          <Button class="gap-2" @click="openCreate">
            <Plus class="size-4" />
            Nova categoria
          </Button>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead class="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="category in store.items" :key="category.id">
              <TableCell class="font-medium">{{ category.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ category.sortOrder }}</TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" @click="openEdit(category)">
                    <Pencil class="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" @click="openDelete(category)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <CategoryFormDialog v-model="formOpen" :category="activeCategory" />
    <DeleteCategoryDialog v-model="deleteOpen" :category="activeCategory" />
  </div>
</template>
