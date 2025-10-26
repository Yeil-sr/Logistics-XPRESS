async function obterListaColetas() {
    try {
        const response = await fetch('/coletas');
        if (!response.ok) {
            throw new Error('Erro ao obter a lista de coletas');
        }
        return await response.json();
    } catch (error) {
        console.error('Erro ao obter a lista de coletas:', error);
        throw error;
    }
}

async function construirTabelaColetas() {
    const coletasContainer = document.getElementById('coletasContainer');
    coletasContainer.innerHTML = '';

    try {
        const coletas = await obterListaColetas();

        const tabela = document.createElement('table');
        tabela.classList.add('table', 'table-hover', 'table-striped');
        tabela.innerHTML = `
            <thead>
                <tr>
                    <th>id_pedido</th>
                    <th>motorista</th>
                    <th>data_coleta</th>
                    <th>agendamento</th>
                    <th>status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = tabela.querySelector('tbody');
     coletas.forEach(coleta => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${coleta.id_pedido}</td>
        <td>${coleta.Motoristum ? coleta.Motoristum.nome : 'N/A'}</td> <!-- Nome do motorista -->
        <td>${coleta.data_coleta}</td>
        <td>${coleta.agendamento}</td>
        <td>${coleta.status}</td>
        <td>
            <button type="button" class="btn btn-primary btn-sm" onclick="editarColeta('${coleta.id}')">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="excluirColeta('${coleta.id}')">Excluir</button>
        </td>
    `;
    tbody.appendChild(tr);
});


        coletasContainer.appendChild(tabela);
    } catch (error) {
        console.error('Erro ao construir a tabela de coletas:', error);
        coletasContainer.innerHTML = '<p>Erro ao carregar a lista de coletas</p>';
    }
}

async function editarColeta(id) {
    try {
        const response = await fetch(`/coleta/${id}`);
        const coleta = await response.json();

        document.getElementById('id').value = coleta.id;
        document.getElementById('id_pedido').value = coleta.id_pedido;
        document.getElementById('id_motorista').value = coleta.id_motorista;
        document.getElementById('data_coleta').value = coleta.data_coleta;
        document.getElementById('agendamento').value = coleta.agendamento;
        document.getElementById('status').value = coleta.status;

        document.getElementById('modal-1').showModal();
    } catch (error) {
        console.error('Erro ao preencher o formulário de edição de coleta:', error);
        alert('Erro ao preencher o formulário de edição de coleta');
    }
}

async function enviarDadosFormularioColeta() {
    try {
        const id = document.getElementById('id').value;
        const id_pedido = document.getElementById('id_pedido').value;
        const id_motorista = document.getElementById('id_motorista').value;
        const data_coleta = document.getElementById('data_coleta').value;
        const agendamento= document.getElementById('agendamento').value;
        const status = document.getElementById('status').value;

        const dadosColeta = {id_pedido, id_motorista, data_coleta, agendamento, status };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/coleta/${id}` : '/coletas';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosColeta)
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar o coleta');
        }

        alert('Coleta salvo com sucesso!');
        construirTabelaColetas();
        document.getElementById('modal-1').close();
    } catch (error) {
        console.error('Erro ao salvar o coleta:', error);
        alert('Erro ao salvar a coleta');
    }
}

async function excluirColeta(id) {
    if (confirm('Deseja realmente excluir esta coleta?')) {
        try {
            const response = await fetch(`/coleta/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error('Erro ao excluir a coleta');
            }
            alert('Coleta excluída com sucesso!');
            construirTabelaColetas();
        } catch (error) {
            console.error('Erro ao excluir a coleta:', error);
            alert('Erro ao excluir a coleta');
        }
    }
}

window.onload = construirTabelaColetas;
