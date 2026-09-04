<script setup lang="ts">
import { toast } from '#layers/base/app/components/ui/sonner'
import { productSchema } from '#shared/schemas/product.schema'
import type { ProductDto } from '#shared/types/domain'

const props = defineProps<{
  product?: ProductDto | null
}>()

const open = defineModel<boolean>({ default: false })

const store = useProductsStore()
const categoriesStore = useCategoriesStore()
const complementGroupsStore = useComplementGroupsStore()

const form = reactive({
  name: '',
  description: '',
  price: '' as number | string,
  promoPrice: '' as number | string,
  cost: '' as number | string,
  categoryId: null as string | null,
  imageUrl: '',
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  complementGroupIds: [] as string[],
})

const submitting = ref(false)
const errorMessage = ref('')
const creatingCategory = ref(false)
const newCategoryName = ref('')

function resetForm() {
  const product = props.product
  form.name = product?.name ?? ''
  form.description = product?.description ?? ''
  form.price = product?.price ?? ''
  form.promoPrice = product?.promoPrice ?? ''
  form.cost = product?.cost ?? ''
  form.categoryId = product?.categoryId ?? null
  form.imageUrl = product?.imageUrl ?? ''
  form.isActive = product?.isActive ?? true
  form.isFeatured = product?.isFeatured ?? false
  form.sortOrder = product?.sortOrder ?? 0
  form.complementGroupIds = product?.complementGroupIds ?? []
  errorMessage.value = ''
  creatingCategory.value = false
  newCategoryName.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) resetForm()
})

const isEditing = computed(() => Boolean(props.product))

function toggleComplementGroup(groupId: string, checked: boolean) {
  if (checked) {
    if (!form.complementGroupIds.includes(groupId)) form.complementGroupIds.push(groupId)
  }
  else {
    form.complementGroupIds = form.complementGroupIds.filter(id => id !== groupId)
  }
}

async function onCreateCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  try {
    const category = await categoriesStore.create({ name, sortOrder: categoriesStore.items.length })
    form.categoryId = category.id
    creatingCategory.value = false
    newCategoryName.value = ''
  }
  catch (error) {
    toast.error(getErrorMessage(error) ?? 'Não foi possível criar a categoria.')
  }
}

async function onSubmit() {
  errorMessage.value = ''
  const parsed = productSchema.safeParse({
    ...form,
    cost: form.cost === '' ? null : form.cost,
    promoPrice: form.promoPrice === '' ? null : form.promoPrice,
  })
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? 'Verifique os campos do formulário.'
    return
  }

  submitting.value = true
  try {
    if (props.product) {
      await store.update(props.product.id, parsed.data)
      toast.success('Produto atualizado.')
    }
    else {
      await store.create(parsed.data)
      toast.success('Produto criado.')
    }
    open.value = false
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error) ?? 'Não foi possível salvar o produto.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEditing ? 'Editar produto' : 'Novo produto' }}</DialogTitle>
        <DialogDescription>
          Esses dados aparecem no seu cardápio digital.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <ProductImageUpload v-model="form.imageUrl" />

        <div class="space-y-1.5">
          <Label for="product-name">Nome</Label>
          <Input id="product-name" v-model="form.name" required placeholder="Ex: X-Burger" />
        </div>

        <div class="space-y-1.5">
          <Label for="product-description">Descrição</Label>
          <Textarea id="product-description" v-model="form.description" placeholder="Ingredientes, detalhes..." />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="product-price">Preço de venda (R$)</Label>
            <Input id="product-price" v-model="form.price" type="number" min="0" step="0.01" required />
          </div>
          <div class="space-y-1.5">
            <Label for="product-cost">Custo (R$, opcional)</Label>
            <Input id="product-cost" v-model="form.cost" type="number" min="0" step="0.01" />
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="product-promo-price">Preço promocional (R$, opcional)</Label>
          <Input id="product-promo-price" v-model="form.promoPrice" type="number" min="0" step="0.01" placeholder="Deixe em branco para não usar" />
          <p class="text-xs text-muted-foreground">Aparece riscado no preço normal, como uma oferta.</p>
        </div>

        <div class="space-y-1.5">
          <Label for="product-category">Categoria</Label>
          <select
            id="product-category"
            v-model="form.categoryId"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          >
            <option :value="null">Sem categoria</option>
            <option v-for="category in categoriesStore.items" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>

          <Button v-if="!creatingCategory" type="button" variant="link" class="h-auto p-0 text-xs" @click="creatingCategory = true">
            + Nova categoria
          </Button>
          <div v-else class="flex gap-2">
            <Input v-model="newCategoryName" placeholder="Nome da categoria" class="flex-1" />
            <Button type="button" size="sm" @click="onCreateCategory">
              Criar
            </Button>
            <Button type="button" size="sm" variant="ghost" @click="creatingCategory = false">
              Cancelar
            </Button>
          </div>
        </div>

        <div v-if="complementGroupsStore.items.length > 0" class="space-y-1.5">
          <Label>Complementos</Label>
          <div class="space-y-2 rounded-md border p-3">
            <div v-for="group in complementGroupsStore.items" :key="group.id" class="flex items-center gap-2">
              <Checkbox
                :model-value="form.complementGroupIds.includes(group.id)"
                @update:model-value="(checked) => toggleComplementGroup(group.id, checked === true)"
              />
              <span class="text-sm">{{ group.name }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p class="text-sm font-medium">Disponível no cardápio</p>
            <p class="text-xs text-muted-foreground">Produtos indisponíveis ficam ocultos para os clientes.</p>
          </div>
          <Switch v-model="form.isActive" />
        </div>

        <div class="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p class="text-sm font-medium">Destacar no cardápio</p>
            <p class="text-xs text-muted-foreground">Aparece na vitrine de destaques, no topo do cardápio.</p>
          </div>
          <Switch v-model="form.isFeatured" />
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Salvando...' : 'Salvar' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
