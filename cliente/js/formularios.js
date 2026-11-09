export const CAMPOS_CLIENTE = `
  <label class="campo"><span>Nombre completo</span><input name="nombre" required minlength="2" maxlength="120" autocomplete="name"></label>
  <label class="campo"><span>Teléfono</span><input name="telefono" type="tel" required pattern="[0-9+ \\(\\)\\-]{6,20}" placeholder="+53 5xxx xxxx" autocomplete="tel"></label>
  <label class="campo"><span>Dirección</span><input name="direccion" maxlength="250" placeholder="Opcional"></label>`

export const CAMPOS_VEHICULO = `
  <div class="formulario formulario--par">
    <label class="campo"><span>Matrícula</span><input name="matricula" required pattern="[A-Za-z0-9\\- ]{4,12}" placeholder="P123456" autocapitalize="characters"></label>
    <label class="campo"><span>Año</span><input name="anio" type="number" required min="1940" max="2100" inputmode="numeric"></label>
    <label class="campo"><span>Marca</span><input name="marca" required maxlength="60"></label>
    <label class="campo"><span>Modelo</span><input name="modelo" required maxlength="60"></label>
    <label class="campo ancho-total"><span>Kilometraje actual</span><input name="kilometraje" type="number" min="0" inputmode="numeric" placeholder="Opcional"></label>
  </div>`

export const CAMPOS_REPUESTO = `
  <input type="hidden" name="id">
  <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="120"></label>
  <div class="formulario formulario--par">
    <label class="campo"><span>Código</span><input name="codigo" required pattern="[A-Za-z0-9\\-]{2,30}" autocapitalize="characters"></label>
    <label class="campo"><span>Precio de venta</span><input name="precio" type="number" required min="0.01" step="0.01" inputmode="decimal"></label>
    <label class="campo"><span>Existencias</span><input name="existencias" type="number" required min="0" value="0" inputmode="numeric"></label>
    <label class="campo"><span>Stock mínimo</span><input name="stock_minimo" type="number" required min="0" value="2" inputmode="numeric"><small>Se avisa al llegar a este número</small></label>
  </div>`

export const pieGuardar = (texto = "Guardar") =>
  `<button type="button" class="boton boton--sobrio" data-cerrar>Cancelar</button><button type="submit" class="boton">${texto}</button>`
