async function obterListaSeparacao() {
    try {
        const response = await fetch('/separacoes/');
        if (!response.ok) throw new Error('Erro ao obter a lista de separações');
        return await response.json();
    } catch (error) {
        console.error('Erro ao obter a lista de separações:', error);
        throw error;
    }
}

async function construirTabelaSeparacao() {
    const separacaoContainer = document.getElementById('separacaoContainer');
    separacaoContainer.innerHTML = '';

    try {
        const separacao = await obterListaSeparacao();

        const tabela = document.createElement('table');
        tabela.classList.add('table', 'table-hover', 'table-striped');
        tabela.innerHTML = `
            <thead>
                <tr>
                    <th>ID Pedido</th>
                    <th>ID Conferência</th>
                    <th>Corredor/Gaiola</th>
                    <th>Data Separação</th>
                    <th>Status</th>
                    <th>Operador</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = tabela.querySelector('tbody');

        separacao.forEach(sep => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sep.id_pedido}</td>
                <td>${sep.id_conferencia}</td>
                <td>${sep.corredor_gaiola}</td>
                <td>${sep.data_separacao? new Date(sep.data_separacao).toLocaleString() : '-'}</td>
                <td>${sep.status}</td>
                <td>${sep.operador_id?.nome || sep.operador_id}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editarSeparacao(${sep.id})">Editar</button>
                    <button class="btn btn-sm btn-success" onclick="concluirSeparacao(${sep.id})">Concluir</button>
                    <button class="btn btn-sm btn-danger" onclick="excluirSeparacao(${sep.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        separacaoContainer.appendChild(tabela);
    } catch (error) {
        console.error('Erro ao construir a tabela de separações:', error);
        conferenciasContainer.innerHTML = '<p>Erro ao carregar a lista de separações</p>';
    }
}

async function editarSeparacao(id) {
    try {
        const response = await fetch(`/separacao/${id}`);
        if (!response.ok) throw new Error('Separação não encontrada');

        const conf = await response.json();

        document.getElementById('id').value = conf.id;
        document.getElementById('id_pedido').value = conf.id_pedido;
        document.getElementById('id_conferencia').value = conf.id_conferencia;
        document.getElementById('corredor_gaiola').value = conf.corredor_gaiola;
        document.getElementById('data_separacao').value = conf.data_separacao;
        document.getElementById('status').value = conf.status;
        document.getElementById('operador_id').value = conf.operador_id;
        document.getElementById('status').value = conf.status;

        document.getElementById('modal-1').showModal();
    } catch (error) {
        console.error('Erro ao editar conferência:', error);
        alert('Erro ao carregar dados da conferência.');
    }
}

async function enviarDadosFormularioSeparacao() {
    try {
        const id = document.getElementById('id').value;
        const dados = {
            id_pedido: document.getElementById('id_pedido').value,
            id_conferencia: document.getElementById('id_conferencia').value,
            corredor_gaiola: document.getElementById('corredor_gaiola').value,
            data_separacao: document.getElementById('data_separacao').value,
            status: document.getElementById('status').value,
            operador_id: document.getElementById('operador_id').value

        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/separacao/${id}` : '/separacao/';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!response.ok) throw new Error('Erro ao salvar separação');

        alert('Separação salva com sucesso!');
        construirTabelaSeparacao();
        document.getElementById('modal-1').close();
    } catch (error) {
        console.error('Erro ao salvar separação:', error);
        alert('Erro ao salvar separação.');
    }
}

async function excluirSeparacao(id) {
    if (confirm('Deseja realmente excluir esta separação?')) {
        try {
            const response = await fetch(`/separacao/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Erro ao excluir separação');

            alert('Separação excluída com sucesso!');
            construirTabelaSeparacao();
        } catch (error) {
            console.error('Erro ao excluir separacao:', error);
            alert('Erro ao excluir separacao.');
        }
    }
}

async function concluirSeparacao(id) {
    if (confirm('Deseja concluir esta separação?')) {
        try {
            const response = await fetch(`/separação${id}/concluir`, { method: 'POST' });
            if (!response.ok) throw new Error('Erro ao concluir separação');

            alert('Separação concluída com sucesso!');
            construirTabelaConferencia();
        } catch (error) {
            console.error('Erro ao concluir separação:', error);
            alert('Erro ao concluir separação.');
        }
    }
}

    function abrirModalPedidos() {
        const separacaoId = document.getElementById("id").value;
        if (!separacaoId) {
            alert("Salve ou selecione uma conferência primeiro.");
            return;
        }
        //separacao/:id/pedidos
        fetch(`/separacao/${separacaoId}/pedidos`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.getElementById("lista-pedidos-separacao");
                tbody.innerHTML = "";
                data.forEach(pedido => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${pedido.codigo_pedido}</td>
                            <td>${pedido.cliente?.nome || '-'}</td>
                            <td>${pedido.produto?.nome || '-'}</td>
                            <td>${pedido.endereco ? pedido.endereco.rua + ', ' + pedido.endereco.numero : '-'}</td>
                            <td>${pedido.status}</td>
                        </tr>
                    `;
                });
                document.getElementById("modal-pedidos").showModal();
            })
            .catch(err => console.error("Erro ao carregar pedidos:", err));
    }

    function fecharModalPedidos() {
        document.getElementById("modal-pedidos").close();
    }


window.onload = construirTabelaSeparacao;
