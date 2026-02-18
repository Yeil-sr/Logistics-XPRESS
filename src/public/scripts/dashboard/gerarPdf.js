const button_gerarPdf = document.getElementById("gerarPdf")

button_gerarPdf.addEventListener("click",()=>{

    const content = document.getElementById("content")

    const options = {
        margin: [10, 10, 10, 10],
        filename: "mdf-e.pdf",
        html2canvas: { scale:2},
        jsPDF: {unit: "mm", format:"a4", orientation:"portrait"}
    }

    html2canvas().set(options).from(content).save();

})