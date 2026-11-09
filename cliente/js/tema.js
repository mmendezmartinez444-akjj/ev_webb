(() => {
  let tema = "oscuro"
  try {
    tema = localStorage.getItem("tema") || (matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "oscuro")
  } catch (_) {
    tema = "oscuro"
  }
  document.documentElement.dataset.tema = tema
})()
