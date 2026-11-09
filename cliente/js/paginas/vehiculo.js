import { pb, esPersonal, mensajeError } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { abrirAsistente } from "../asistente.js"
import { CAMPOS_VEHICULO, pieGuardar } from "../formularios.js"
import { guardarVehiculo, rellenarFormulario } from "../registros.js"
import { icono } from "../iconos.js"
import {
  $, abrirHoja, alEnviar, aviso, cerrarHoja, dinero, entero, escapar, estaCerrada, estado, fecha, hoja, parametro, placa,
  prepararHojas, vacio,
} from "../ui.js"

const vehiculoId = parametro("id")
let vehiculo = null

const pintar = (ordenes) => {
  const cliente = vehiculo.expand?.cliente
  const validas = ordenes.filter((o) => o.estado !== "cancelada")
  document.title = `${vehiculo.matricula} · El Pistón`
  $("#volver-cliente").href = `clientes.html?id=${vehiculo.cliente}`
  $("#volver-cliente").lastChild.textContent = cliente?.nombre ?? "Cliente"
  $("#heroe-vehiculo").innerHTML = `
    <div class="heroe__arriba">
      <div class="heroe__identidad">
        ${placa(vehiculo.matricula, true)}
        <div>
          <h1>${escapar(vehiculo.marca)} ${escapar(vehiculo.modelo)} <span class="tenue">${vehiculo.anio}</span></h1>
          <div class="tenue">De <a href="clientes.html?id=${vehiculo.cliente}">${escapar(cliente?.nombre)}</a> · ${escapar(cliente?.telefono)}</div>
        </div>
      </div>
      <div class="contacto">
        <button type="button" class="boton boton--sobrio boton--chico" id="editar-vehiculo">${icono("lapiz")}Editar</button>
        <button type="button" class="boton boton--chico" id="nueva-orden">${icono("mas")}Nueva orden</button>
      </div>
    </div>`
  $("#cifras-vehiculo").innerHTML = `
    <div class="cifra"><span class="etiqueta">Kilometraje</span><span class="cifra__valor">${entero(vehiculo.kilometraje)}</span><span class="cifra__nota">km registrados</span></div>
    <div class="cifra"><span class="etiqueta">Visitas</span><span class="cifra__valor">${validas.length}</span><span class="cifra__nota">sin contar canceladas</span></div>
    <div class="cifra cifra--acento"><span class="etiqueta">Invertido</span><span class="cifra__valor">${dinero(validas.reduce((s, o) => s + o.total, 0))}</span><span class="cifra__nota">en el taller</span></div>
    <div class="cifra"><span class="etiqueta">Última visita</span><span class="cifra__valor">${ordenes[0] ? fecha(ordenes[0].fecha_entrada) : "—"}</span></div>`
  $("#linea-tiempo").innerHTML = ordenes.map((o) => {
    const trabajos = o.expand?.trabajos_via_orden ?? []
    const repuestos = o.expand?.orden_repuestos_via_orden ?? []
    const clase = o.estado === "cancelada" ? "hito--cancelada" : estaCerrada(o.estado) ? "" : "hito--abierta"
    return `
      <li class="hito ${clase}">
        <a class="hito__tarjeta" href="orden.html?id=${o.id}">
          <div class="hito__cabecera">
            <strong>${fecha(o.fecha_entrada)}${o.kilometraje ? ` · ${entero(o.kilometraje)} km` : ""}</strong>
            ${estado(o.estado)}
          </div>
          <div>${escapar(o.problema)}</div>
          ${trabajos.length || repuestos.length ? `<ul class="hito__lista">
            ${trabajos.map((t) => `<li>${escapar(t.descripcion)} · ${dinero(t.precio)}</li>`).join("")}
            ${repuestos.map((r) => `<li>${entero(r.cantidad)} × ${escapar(r.expand?.repuesto?.nombre)}</li>`).join("")}
          </ul>` : '<span class="tenue">Sin trabajos anotados</span>'}
          <div class="tarjeta-orden__pie"><span>${escapar(o.expand?.mecanico?.name)}</span><strong>${dinero(o.total)}</strong></div>
        </a>
      </li>`
  }).join("") || `<li>${vacio("Este vehículo todavía no tiene servicios.", "coche")}</li>`
}

const cargar = async () => {
  const [datos, ordenes] = await Promise.all([
    pb.collection("vehiculos").getOne(vehiculoId, { expand: "cliente" }),
    pb.collection("ordenes").getFullList({
      filter: pb.filter("vehiculo = {:v}", { v: vehiculoId }),
      sort: "-fecha_entrada",
      expand: "mecanico,trabajos_via_orden,orden_repuestos_via_orden.repuesto",
    }),
  ])
  vehiculo = datos
  pintar(ordenes)
}

const usuario = await iniciarPagina("clientes")

if (usuario) {
  if (!esPersonal() || !vehiculoId) {
    location.replace("index.html")
  } else {
    $("#hojas-vehiculo").innerHTML = hoja({ id: "hoja-vehiculo", titulo: "Editar vehículo", cuerpo: `<input type="hidden" name="cliente">${CAMPOS_VEHICULO}`, pie: pieGuardar("Guardar cambios") })
    prepararHojas()
    alEnviar($("#hoja-vehiculo form"), async (datos) => {
      await guardarVehiculo(datos, vehiculoId)
      cerrarHoja($("#hoja-vehiculo"))
      aviso("Vehículo actualizado")
      await cargar()
    })
    $("#heroe-vehiculo").addEventListener("click", (evento) => {
      if (evento.target.closest("#editar-vehiculo")) {
        abrirHoja($("#hoja-vehiculo"))
        rellenarFormulario($("#hoja-vehiculo form"), vehiculo)
      }
      if (evento.target.closest("#nueva-orden")) abrirAsistente({ vehiculoId })
    })
    try {
      await cargar()
    } catch (error) {
      $("#heroe-vehiculo").innerHTML = vacio(mensajeError(error), "alerta")
    }
  }
}
