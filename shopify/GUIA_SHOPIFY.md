# Emprende con Gold Mills en Shopify: guía de puesta en marcha

## Qué está listo
- **Tema con la marca:** naranja y café, letra Outfit y Nunito Sans.
- **Inicio con las mismas secciones de la web de Netlify:**
  - Hero "Tu sueño también se hornea"
  - Beneficios
  - Lo más pedido, con botón "+ Agregar"
  - Compra por categoría
  - Misión y visión
  - Crecemos contigo
- **Carrito con "¿Dónde recibes tu pedido?" obligatorio:**
  - Lista los 26 corregimientos, La Chorrera, Arraiján, San Miguelito, Chepo y "Otra".
  - Al elegir, el cliente ve su zona y su día de entrega.
  - El pedido lleva Localidad, Zona, Día de entrega y Referencia; en el admin se ven en *Pedido → Detalles adicionales*.
- **Productos:** `productos_shopify.csv` trae los 67 productos, con precio, código (SKU), categoría (Tipo) y 58 fotos.
- **Sin WhatsApp:** el pago lo hace Shopify.

## Pasos en orden

### 1. Guardar la tienda
Abre el enlace "Guardar tienda" y crea o entra a tu cuenta de Shopify. Hasta que la guardes, cualquiera con la dirección puede verla y editarla.

### 2. Idioma español
*Configuración → Idiomas → Cambiar idioma predeterminado → Español.*

Esto traduce botones como "Product title", "Search" y "Privacy policy".

### 3. Importar productos
*Productos → Importar → subir `productos_shopify.csv`.* Las fotos se descargan solas.

Quedan sin foto: 320007, 320008, 8858, 310431, 320013, 1799, 1797, 9232 y 1301. Súbelas en cada producto cuando las tengas.

### 4. Crear las colecciones (automáticas)
*Productos → Colecciones → Crear colección → Automatizada.* El nombre debe escribirse exacto.

| Nombre | Condición |
|---|---|
| Harinas | Tipo de producto es igual a Harinas |
| Aceites y Grasas | Tipo de producto es igual a Aceites y Grasas |
| Rellenos | Tipo de producto es igual a Rellenos |
| Esencias | Tipo de producto es igual a Esencias |
| Levaduras | Tipo de producto es igual a Levaduras |
| Complementos | Tipo de producto es igual a Complementos |
| Café y Bebidas | Tipo de producto es igual a Café y Bebidas |
| Más pedido | Etiqueta de producto es igual a Más pedido |

El inicio busca estas colecciones por su nombre web (harinas, aceites-y-grasas, …, mas-pedido).

### 5. Menú
*Tienda online → Navegación → Menú principal.* Cambia Home/Catalog/Contact por Inicio, Catálogo y las categorías que quieras.

### 6. Pagos: tarjeta y Yappy (Tilopay)
Shopify Payments no opera en Panamá. Necesitas:
1. Una cuenta comercial de Tilopay a nombre de la empresa.
2. En Shopify, *Configuración → Pagos → Agregar método de pago*: instala **Tilopay** (tarjetas) y **Yappy por Tilopay**.
3. Conecta ambos con las credenciales que te da Tilopay.
4. Haz una compra de prueba.

Los gateways externos pagan una comisión de Shopify por venta (2 % en el plan Basic), además de la de Tilopay.

### 7. Envío
*Configuración → Envío y entrega → Panamá.* Crea una tarifa **"Entrega en tu día de ruta" a $0.00**.

### 8. Cuentas de cliente
*Configuración → Cuentas de clientes:* activa las cuentas. El cliente entra con su correo y un código; ahí ve sus pedidos y puede repetirlos.

### 9. Logo en el encabezado
*Configuración → Marca → Logo.* Hoy el encabezado muestra el nombre en texto.

### 10. Plan
Para vender necesitas un plan pago: el Basic cuesta $27/mes con pago mensual o $19/mes con pago anual (verifica el precio vigente al contratar).

## Para cambiar zonas o días
Ve a *Tienda online → Temas → Editar código → `snippets/egm-zona-entrega.liquid`*. Las primeras líneas tienen dos listas:
- `zonas`: código, nombre y día de cada zona.
- `localidades`: grupo, nombre, barrio de referencia y código de zona.

## Imágenes del inicio
La foto del hero y el logo se cargan desde el repositorio de GitHub del proyecto. Si quieres que vivan dentro de Shopify, súbelos en el editor del tema y reemplázalos.
