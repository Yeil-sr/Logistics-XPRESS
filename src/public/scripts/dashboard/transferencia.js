let transferenciaAtual = null;
const API_BASE = 'http://localhost:8080';

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const transferenciaId = urlParams.get('id');
    
    if (transferenciaId) {
        carregarDetalhesTransferencia(transferenciaId);
    } else {
        construirTabelaTransferencias();
        carregarHubs();
        carregarMotoristas();
    }
});

// Funções para carregar dados
async function carregarHubs() {
    try {
        const hubs = await apiRequest('/hubs');
        
        const origemSelect = document.getElementById('origem-hub');
        const destinoSelect = document.getElementById('destino-hub');
        
        if (origemSelect) {
            origemSelect.innerHTML = '<option value="">Selecione o hub de origem</option>';
        }
        
        if (destinoSelect) {
            destinoSelect.innerHTML = '<option value="">Selecione o hub de destino</option>';
        }
        
        hubs.forEach(hub => {
            if (origemSelect) {
                const option = document.createElement('option');
                option.value = hub.id;
                option.textContent = hub.nome;
                origemSelect.appendChild(option);
            }
            
            if (destinoSelect) {
                const option = document.createElement('option');
                option.value = hub.id;
                option.textContent = hub.nome;
                destinoSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar hubs:', error);
        alert('Erro ao carregar hubs');
    }
}

async function carregarMotoristas() {
    try {
        const motoristas = await apiRequest('/motoristas');
        
        const select = document.getElementById('motorista-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um motorista</option>';
        
        motoristas.forEach(motorista => {
            const option = document.createElement('option');
            option.value = motorista.id;
            option.textContent = motorista.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
        alert('Erro ao carregar motoristas');
    }
}

// Funções para transferências
async function obterListaTransferencias() {
    try {
        return await apiRequest('/transferencias');
    } catch (error) {
        console.error('Erro ao obter lista de transferências:', error);
        throw error;
    }
}

async function construirTabelaTransferencias() {
    const container = document.getElementById('transferenciasContainer');
    if (!container) return;
    
    try {
        const transferencias = await obterListaTransferencias();
        container.innerHTML = '';

        if (transferencias.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhuma transferência encontrada</div>';
            return;
        }

        const tabela = document.createElement('table');
        tabela.classList.add('table', 'table-hover', 'table-striped');
        tabela.innerHTML = `
            <thead>
                <tr>
                    <th>Nº TO</th>
                    <th>Motorista</th>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Status</th>
                    <th>Data Criação</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = tabela.querySelector('tbody');
        transferencias.forEach(transf => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${transf.numero_TO || '-'}</td>
                <td>${transf.Motorista?.nome || '-'}</td>
                <td>${transf.origemHub?.nome || transf.origem_hub_id}</td>
                <td>${transf.destinoHub?.nome || transf.destino_hub_id}</td>
                <td><span class="badge ${getStatusBadgeClass(transf.status)}">${transf.status}</span></td>
                <td>${new Date(transf.data_criacao).toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="verDetalhesTransferencia('${transf.id}')">Detalhes</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirTransferencia('${transf.id}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        container.appendChild(tabela);
    } catch (error) {
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar transferências</div>';
    }
}

function getStatusBadgeClass(status) {
    const classes = {
        'CRIADO': 'badge-secondary',
        'EM_TRANSPORTE': 'badge-primary',
        'RECEBIDO': 'badge-success',
        'CANCELADO': 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
}

function verDetalhesTransferencia(id) {
    window.location.href = `/dashboard/transferencia?id=${id}`;
}

async function carregarDetalhesTransferencia(id) {
    try {
        // Mostrar view de detalhes e esconder lista
        const listaView = document.getElementById('lista-view');
        const detalheView = document.getElementById('detalhe-view');
        const pageTitle = document.getElementById('page-title');
        
        if (listaView) listaView.style.display = 'none';
        if (detalheView) detalheView.style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Detalhes da Transferência';

        const transferencia = await apiRequest(`/transferencias/${id}`);
        transferenciaAtual = transferencia;

        // Preencher os dados
        const numeroTo = document.getElementById('numero-to');
        const hubOrigem = document.getElementById('hub-origem');
        const hubDestino = document.getElementById('hub-destino');
        const motorista = document.getElementById('motorista');
        const dataCriacao = document.getElementById('data-criacao');
        const statusElement = document.getElementById('status-transferencia');
        const btnConcluir = document.getElementById('btn-concluir-transferencia');
        
        if (numeroTo) numeroTo.textContent = transferencia.numero_TO || '-';
        if (hubOrigem) hubOrigem.textContent = transferencia.origemHub?.nome || transferencia.origem_hub_id;
        if (hubDestino) hubDestino.textContent = transferencia.destinoHub?.nome || transferencia.destino_hub_id;
        if (motorista) motorista.textContent = transferencia.Motorista?.nome || '-';
        if (dataCriacao) dataCriacao.textContent = new Date(transferencia.data_criacao).toLocaleString();

        // Status
        if (statusElement) {
            statusElement.textContent = transferencia.status;
            statusElement.className = `badge ${getStatusBadgeClass(transferencia.status)}`;
        }

        // Configurar botões de ação
        if (btnConcluir) {
            btnConcluir.style.display = transferencia.status === 'EM_TRANSPORTE' ? 'block' : 'none';
            
            // Remover event listeners anteriores e adicionar novo
            const newBtn = btnConcluir.cloneNode(true);
            btnConcluir.parentNode.replaceChild(newBtn, btnConcluir);
            newBtn.addEventListener('click', concluirTransferencia);
        }

        // Carregar timeline
        carregarTimelineTransferencia(transferencia);

        // Carregar pedidos
        await carregarPedidosTransferencia(id);

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        const detalheView = document.getElementById('detalhe-view');
        if (detalheView) {
            detalheView.innerHTML = '<div class="alert alert-danger">Erro ao carregar transferência</div>';
        }
    }
}

async function carregarPedidosTransferencia(transferenciaId) {
    try {
        const pedidos = await apiRequest(`/transferencias/${transferenciaId}/pedidos`);
        const tbody = document.getElementById('tabela-pedidos');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum pedido encontrado</td></tr>';
            return;
        }

        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pedido.codigo_pedido || '-'}</td>
                <td>${pedido.cliente?.nome || '-'}</td>
                <td>${pedido.produto?.nome || '-'}</td>
                <td>${pedido.status || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        const tbody = document.getElementById('tabela-pedidos');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar pedidos</td></tr>';
        }
    }
}

function carregarTimelineTransferencia(transferencia) {
    const container = document.getElementById('timeline-transferencia');
    if (!container) return;
    
    container.innerHTML = '';
    
    const steps = [
        { 
            event: 'Transferência criada', 
            date: transferencia.data_criacao, 
            active: true 
        },
        { 
            event: 'Transporte iniciado', 
            date: transferencia.data_inicio_transporte, 
            active: transferencia.status === 'EM_TRANSPORTE' || transferencia.status === 'RECEBIDO' 
        },
        { 
            event: 'Transferência concluída', 
            date: transferencia.data_conclusao, 
            active: transferencia.status === 'RECEBIDO' 
        }
    ];
    
    steps.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = `timeline-step ${step.active ? 'active' : ''}`;
        
        stepElement.innerHTML = `
            <h5>${step.event}</h5>
            <small>${step.date ? new Date(step.date).toLocaleString() : 'Pendente'}</small>
            ${index < steps.length - 1 ? '<div class="timeline-connector"></div>' : ''}
        `;
        
        container.appendChild(stepElement);
    });
}

async function concluirTransferencia() {
    if (!transferenciaAtual || !confirm('Deseja concluir esta transferência?')) return;
    
    try {
        await apiRequest(`/transferencias/${transferenciaAtual.id}/concluir`, 'POST');
        
        alert('Transferência concluída com sucesso!');
        carregarDetalhesTransferencia(transferenciaAtual.id);
    } catch (error) {
        console.error('Erro ao concluir transferência:', error);
        alert('Erro ao concluir transferência');
    }
}

async function excluirTransferencia(id) {
    if (!confirm('Deseja realmente excluir esta transferência?')) return;
    
    try {
        await apiRequest(`/transferencias/${id}`, 'DELETE');
        
        alert('Transferência excluída com sucesso!');
        construirTabelaTransferencias();
    } catch (error) {
        console.error('Erro ao excluir transferência:', error);
        alert('Erro ao excluir transferência');
    }
}

function abrirModalTransferencia() {
    const modalElement = document.getElementById('modal-transferencia');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

async function salvarTransferencia() {
    const numeroToInput = document.getElementById('numero-to-input');
    const origemHub = document.getElementById('origem-hub');
    const destinoHub = document.getElementById('destino-hub');
    const motoristaSelect = document.getElementById('motorista-select');
    
    if (!numeroToInput || !origemHub || !destinoHub || !motoristaSelect) return;
    
    const formData = {
        numero_TO: numeroToInput.value,
        origem_hub_id: origemHub.value,
        destino_hub_id: destinoHub.value,
        motorista_id: motoristaSelect.value
    };
    
    // Validação
    if (!formData.numero_TO || !formData.origem_hub_id || !formData.destino_hub_id) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }
    
    try {
        toggleLoading(document.getElementById('btn-salvar-transferencia'), true);
        
        await apiRequest('/transferencias', 'POST', formData);
        
        alert('Transferência criada com sucesso!');
        
        const modalElement = document.getElementById('modal-transferencia');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
        
        construirTabelaTransferencias();
    } catch (error) {
        console.error('Erro ao criar transferência:', error);
        alert('Erro ao criar transferência');
    } finally {
        toggleLoading(document.getElementById('btn-salvar-transferencia'), false);
    }
}

function voltarParaLista() {
    window.location.href = '/dashboard/transferencia';
}

function imprimirManifesto() {
    alert('Funcionalidade de impressão de manifesto será implementada aqui');
}

// Funções auxiliares
function toggleLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        const btnText = button.querySelector('.btn-text');
        const loading = button.querySelector('.loading');
        
        if (btnText) btnText.style.display = 'none';
        if (loading) loading.style.display = 'inline-block';
    } else {
        button.disabled = false;
        const btnText = button.querySelector('.btn-text');
        const loading = button.querySelector('.loading');
        
        if (btnText) btnText.style.display = 'inline-block';
        if (loading) loading.style.display = 'none';
    }
}

// Configurar eventos
document.addEventListener('DOMContentLoaded', function() {
    const btnSalvar = document.getElementById('btn-salvar-transferencia');
    const btnConcluir = document.getElementById('btn-concluir-transferencia');
    
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarTransferencia);
    }
    
    if (btnConcluir) {
        btnConcluir.addEventListener('click', concluirTransferencia);
    }
});

function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return Promise.reject('Não autenticado');
    }

    const headers = new Headers({
        'Content-Type': 'application/json',
        ...(options.headers || {})
    });
    headers.set('Authorization', `Bearer ${token}`);

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 204) return { ok: true, data: null };

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            console.warn('Token inválido ou não fornecido');
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = '/login.html';
            return { ok: false, data: { message: 'Não autorizado' } };
        }

        return { ok: response.ok, data };
    } catch (err) {
        console.error('Erro na requisição:', err);
        return { ok: false, data: { message: 'Erro de conexão' } };
    }
}

async function apiRequest(path, method = 'GET', data = null, query = null) {
    try {
        const url = new URL(API_BASE + path);
        if (query && typeof query === 'object') {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.append(k, v);
            });
        }

        const options = { method };
        if (data && (method === 'POST' || method === 'PUT')) options.body = JSON.stringify(data);

        const { ok, data: responseData } = await apiFetch(url.toString(), options);

        if (!ok) throw new Error(responseData.message || 'Erro desconhecido');

        return responseData;
    } catch (err) {
        console.error('API request error:', path, err);
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!verificarAutenticacao()) return;

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.nome) {
        const navbarUserName = document.getElementById('navbar-user-name');
        const dropdownUserName = document.getElementById('dropdown-user-name');

        if (navbarUserName) navbarUserName.textContent = userData.nome;
        if (dropdownUserName) dropdownUserName.textContent = userData.nome;
    }

    if (userData.role) {
        const dropdownUserRole = document.getElementById('dropdown-user-role');
        if (dropdownUserRole) dropdownUserRole.textContent = userData.role;
    }

    carregarConferencias();
    carregarRecebimentos();

    configurarEventos();
});