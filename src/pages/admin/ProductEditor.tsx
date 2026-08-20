import { useRef, useState, type FormEvent } from 'react';
import type { Product } from '../../types/product.types';
import type { Category } from '../../types/category.types';
import * as productService from '../../services/product.service';
import * as storageService from '../../services/storage.service';
import { ApiError } from '../../services/apiClient';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { SafeImage } from '../../components/ui/SafeImage';
import { Badge } from '../../components/ui/Badge';

interface ProductEditorProps {
  product: Product;
  categories: Category[];
  onUpdated: (product: Product) => void;
  onClose: () => void;
}

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/** Editor inline: datos del plato + gestión de imágenes y modelo 3D. Se usa expandido bajo la fila del producto en ProductsPage. */
export function ProductEditor({ product, categories, onUpdated, onClose }: ProductEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [savingFields, setSavingFields] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingUsdz, setUploadingUsdz] = useState(false);
  const [newImageAlt, setNewImageAlt] = useState('');
  const [newModelDiameterCm, setNewModelDiameterCm] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const usdzInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveFields(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingFields(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await productService.updateProduct(product.id, {
        name: String(form.get('name')),
        description: String(form.get('description') ?? ''),
        priceMinor: Math.round(Number(form.get('priceMinor'))),
        categoryId: String(form.get('categoryId')),
        ingredients: String(form.get('ingredients') ?? '')
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
      });
      onUpdated(res.product);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos guardar los cambios.');
    } finally {
      setSavingFields(false);
    }
  }

  async function handleUploadImage(e: FormEvent) {
    e.preventDefault();
    const file = imageInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona un archivo de imagen.');
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const res = await storageService.uploadProductImage(product.id, file, newImageAlt || product.name);
      const existingImages = res.image.isPrimary
        ? product.images.map((img) => ({ ...img, isPrimary: false }))
        : product.images;
      onUpdated({ ...product, images: [...existingImages, res.image] });
      setNewImageAlt('');
      if (imageInputRef.current) imageInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    setError(null);
    try {
      await storageService.deleteProductImage(product.id, imageId);
      onUpdated({ ...product, images: product.images.filter((img) => img.id !== imageId) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos eliminar la imagen.');
    }
  }

  async function handleUploadModel(e: FormEvent) {
    e.preventDefault();
    const file = modelInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona un archivo .glb.');
      return;
    }
    setUploadingModel(true);
    setError(null);
    try {
      const diameterMeters = newModelDiameterCm.trim() ? Number(newModelDiameterCm) / 100 : undefined;
      const res = await storageService.uploadProductModel(product.id, file, diameterMeters);
      onUpdated({ ...product, model3D: res.model });
      if (modelInputRef.current) modelInputRef.current.value = '';
      setNewModelDiameterCm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos subir el modelo 3D.');
    } finally {
      setUploadingModel(false);
    }
  }

  async function handleDeleteModel() {
    setError(null);
    try {
      await storageService.deleteProductModel(product.id);
      onUpdated({ ...product, model3D: undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos eliminar el modelo 3D.');
    }
  }

  async function handleUploadUsdz(e: FormEvent) {
    e.preventDefault();
    const file = usdzInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona un archivo .usdz.');
      return;
    }
    setUploadingUsdz(true);
    setError(null);
    try {
      const res = await storageService.uploadProductModelUsdz(product.id, file);
      onUpdated({ ...product, model3D: res.model });
      if (usdzInputRef.current) usdzInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos subir el archivo .usdz.');
    } finally {
      setUploadingUsdz(false);
    }
  }

  async function handleDeleteUsdz() {
    setError(null);
    try {
      await storageService.deleteProductModelUsdz(product.id);
      onUpdated({ ...product, model3D: product.model3D ? { ...product.model3D, usdzUrl: null, usdzSizeBytes: null } : undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos eliminar el archivo .usdz.');
    }
  }

  return (
    <div className="admin-product-editor">
      {error && <ErrorMessage message={error} />}

      <form className="admin-form" onSubmit={handleSaveFields}>
        <label className="admin-form__field">
          Nombre
          <input name="name" defaultValue={product.name} required maxLength={150} />
        </label>
        <label className="admin-form__field">
          Descripción
          <textarea name="description" defaultValue={product.description} rows={2} maxLength={2000} />
        </label>
        <label className="admin-form__field">
          Ingredientes (separados por coma)
          <input name="ingredients" defaultValue={product.ingredients.join(', ')} maxLength={2000} />
        </label>
        <label className="admin-form__field">
          Precio (COP)
          <input name="priceMinor" type="number" min={0} step={1} defaultValue={product.priceMinor} required />
        </label>
        <label className="admin-form__field">
          Categoría
          <select name="categoryId" defaultValue={product.categoryId} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-table__actions">
          <Button type="submit" disabled={savingFields}>
            {savingFields ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </form>

      <div className="admin-product-editor__media">
        <h3 className="admin-product-editor__subtitle">Imágenes ({product.images.length}/6)</h3>
        <div className="admin-product-editor__gallery">
          {product.images.map((image) => (
            <div key={image.id} className="admin-product-editor__thumb">
              <SafeImage src={image.url} alt={image.alt} className="admin-product-editor__thumb-image" />
              {image.isPrimary && <Badge tone="accent">Principal</Badge>}
              <Button variant="ghost" size="md" onClick={() => handleDeleteImage(image.id)}>
                Eliminar
              </Button>
            </div>
          ))}
        </div>
        {product.images.length < 6 && (
          <form className="admin-form" onSubmit={handleUploadImage} style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <label className="admin-form__field">
              Archivo de imagen
              <input ref={imageInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} required />
            </label>
            <label className="admin-form__field">
              Texto alternativo
              <input value={newImageAlt} onChange={(e) => setNewImageAlt(e.target.value)} maxLength={200} placeholder={product.name} />
            </label>
            <Button type="submit" disabled={uploadingImage}>
              {uploadingImage ? 'Subiendo…' : 'Agregar imagen'}
            </Button>
          </form>
        )}

        <h3 className="admin-product-editor__subtitle">Modelo 3D (.glb)</h3>
        {product.model3D ? (
          <div className="admin-table__actions">
            <span>{(product.model3D.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
            <span>
              {product.model3D.realWorldDiameterMeters != null
                ? `Tamaño real: ${(product.model3D.realWorldDiameterMeters * 100).toFixed(0)} cm`
                : 'Sin tamaño real declarado (se estima automáticamente en AR)'}
            </span>
            <Button variant="ghost" size="md" onClick={handleDeleteModel}>
              Eliminar modelo
            </Button>
          </div>
        ) : (
          <form className="admin-form" onSubmit={handleUploadModel} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <label className="admin-form__field">
              Archivo .glb
              <input ref={modelInputRef} type="file" accept=".glb,model/gltf-binary" required />
            </label>
            <label className="admin-form__field">
              Tamaño real (cm, opcional)
              <input
                type="number"
                min="1"
                max="200"
                step="0.5"
                placeholder="ej: 25"
                value={newModelDiameterCm}
                onChange={(e) => setNewModelDiameterCm(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={uploadingModel}>
              {uploadingModel ? 'Subiendo…' : 'Subir modelo'}
            </Button>
          </form>
        )}

        {product.model3D && (
          <>
            <h3 className="admin-product-editor__subtitle">AR Quick Look para iPhone (.usdz)</h3>
            <p className="admin-product-editor__hint">
              Opcional. Safari no soporta WebXR — sin este archivo, el botón "Ver en mi mesa" no aparece en iPhone
              (nunca uno que fallaría al abrirse). Exportá el mismo plato en formato .usdz desde tu app de escaneo o
              generación 3D y subilo acá.
            </p>
            {product.model3D.usdzUrl ? (
              <div className="admin-table__actions">
                <span>{((product.model3D.usdzSizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB</span>
                <Button variant="ghost" size="md" onClick={handleDeleteUsdz}>
                  Eliminar .usdz
                </Button>
              </div>
            ) : (
              <form className="admin-form" onSubmit={handleUploadUsdz} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <label className="admin-form__field">
                  Archivo .usdz
                  <input ref={usdzInputRef} type="file" accept=".usdz,model/vnd.usdz+zip" required />
                </label>
                <Button type="submit" disabled={uploadingUsdz}>
                  {uploadingUsdz ? 'Subiendo…' : 'Subir .usdz'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
