import { pb, iniciarSesion, mensajeError } from "../api.js"
import { $, $$, conCarga, datosFormulario, mostrarError } from "../ui.js"

if (pb.authStore.isValid) location.replace("index.html")

const formulario = $("#formulario-acceso")

$$(".cuenta-demo").forEach((boton) =>
  boton.addEventListener("click", () => {
    formulario.elements.email.value = boton.dataset.correo
    formulario.elements.password.value = ""
    formulario.elements.password.focus()
  }),
)

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault()
  mostrarError(formulario, "")
  if (!formulario.checkValidity()) {
    mostrarError(formulario, "Escriba un correo válido y una contraseña de al menos 8 caracteres.")
    return
  }
  const { email, password } = datosFormulario(formulario)
  await conCarga(formulario.querySelector("button[type=submit]"), async () => {
    try {
      await iniciarSesion(email.trim(), password)
      location.replace("index.html")
    } catch (error) {
      mostrarError(formulario, error.status === 400 ? "Correo o contraseña incorrectos." : mensajeError(error))
    }
  })
})
