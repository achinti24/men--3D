# Base de datos

Diseño relacional propuesto para Fase 2. No implementado todavía en este repositorio (Fase 1 usa datos en memoria) — este documento fija el contrato que `services/*.ts` asumirá al conectar el backend real, y ya coincide con los tipos en `src/types/`.

## Entidades y relaciones

```
User ──< RestaurantMember >── Restaurant ──< Category ──< Product ──< ProductImage
                                    │                          └────< ProductModel
                                    ├──< QR
                                    └──< AuditLog
```

## Tablas

### `users`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| email | text UNIQUE | |
| password_hash | text | nunca se devuelve al frontend |
| full_name | text | |
| role | enum(ADMIN, RESTAURANT_OWNER, RESTAURANT_STAFF) | `CUSTOMER` no crea fila: el menú público es anónimo |
| created_at, updated_at | timestamptz | |

### `restaurants`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| slug | text UNIQUE NOT NULL | índice único, usado en la URL pública |
| name, description | text | |
| logo_url, cover_image_url | text | apuntan a Storage, nunca al filesystem local |
| address, phone | text | |
| social_links | jsonb | `{ instagram, facebook, whatsapp, website }` |
| schedule | jsonb | array de `{ day, opensAt, closesAt, closed }` |
| currency | enum(COP, USD, MXN) | |
| created_at, updated_at | timestamptz | |

### `restaurant_members`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| restaurant_id | uuid FK → restaurants | |
| role | enum(RESTAURANT_OWNER, RESTAURANT_STAFF) | |
| UNIQUE(user_id, restaurant_id) | | evita membresías duplicadas |

### `categories`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK → restaurants NOT NULL | índice compuesto `(restaurant_id, order)` |
| name, slug | text | `slug` único por restaurante, no global |
| order | int | |

### `products`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK → restaurants NOT NULL | redundante con `category.restaurant_id` a propósito: permite validar el tenant en una sola condición de WHERE sin JOIN |
| category_id | uuid FK → categories NOT NULL | |
| name, description | text | |
| ingredients | text[] | |
| price_minor | bigint NOT NULL | entero en unidad menor de la moneda — **nunca** `numeric`/`float` para evitar redondeos |
| available, featured | boolean | |
| order | int | |
| created_at, updated_at | timestamptz | |

### `product_images`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products NOT NULL | |
| url, thumbnail_url | text | Storage, con variantes generadas al subir |
| alt | text NOT NULL | accesibilidad, obligatorio |
| is_primary | boolean | solo una `true` por producto (constraint a nivel de aplicación) |

### `product_models`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products UNIQUE | relación 1:1 por ahora |
| url | text | |
| format | enum(glb, gltf) | |
| size_bytes | bigint | usado para advertir en conexiones lentas |
| poster_url | text | imagen mostrada mientras carga el modelo |

### `qr_codes`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK → restaurants | |
| target_path | text | siempre `/menu/:slug`, nunca una URL temporal/firmada con expiración |
| created_at | timestamptz | |

### `audit_logs`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK → restaurants | nullable para acciones a nivel plataforma |
| user_id | uuid FK → users | |
| action | text | ej. `product.updated`, `category.deleted` |
| metadata | jsonb | diff o contexto adicional |
| created_at | timestamptz | |

## Índices clave

- `restaurants(slug)` — UNIQUE, es la ruta de entrada de todo el tráfico público.
- `categories(restaurant_id, order)` — orden del menú por tenant.
- `products(restaurant_id, category_id, order)` — listado del menú público.
- `restaurant_members(user_id, restaurant_id)` — UNIQUE, resolución de permisos en cada request autenticado.

## Por qué `price_minor` es entero

Ver `src/types/product.types.ts` y `src/utils/formatCurrency.ts` en el frontend: el dinero nunca se representa como `float` en ningún punto del sistema, de la base de datos a la UI. Sumar o comparar precios en punto flotante puede producir errores de redondeo acumulados — con enteros, la aritmética es exacta.
