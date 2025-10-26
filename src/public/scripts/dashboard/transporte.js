// transporte.js - VERSÃO COMPLETA E ATUALIZADA

// Configurações
const API_BASE_URL = 'http://localhost:8080';
const PAGE_SIZE = 10;

// Status maps
const STATUS_TRANSPORTE = {
    'CRIADO': { class: 'badge-criado', text: 'Criado' },
    'EM_TRANSPORTE': { class: 'badge-em-transporte', text: 'Em Transporte' },
    'RECEBIDO': { class: 'badge-recebido', text: 'Recebido' },
    'CANCELADO': { class: 'badge-cancelado', text: 'Cancelado' }
};

const STATUS_CONFERENCIA = {
    'PENDENTE': { class: 'badge-warning', text: 'Pendente' },
    'EM_ANDAMENTO': { class: 'badge-info', text: 'Em Andamento' },
    'CONCLUIDO': { class: 'badge-success', text: 'Concluído' },
    'EXCECAO': { class: 'badge-danger', text: 'Exceção' }
};

const STATUS_ROTA = {
    'CRIADA': { class: 'badge-secondary', text: 'Criada' },
    'EM_ANDAMENTO': { class: 'badge-warning', text: 'Em Andamento' },
    'FINALIZADA': { class: 'badge-success', text: 'Finalizada' },
    'CANCELADA': { class: 'badge-danger', text: 'Cancelada' }
};

// Estado global
let transportesData = [];
let currentPage = 1;
let totalPages = 1;
let currentTransporteId = null;
let hubsData = [];
let conferenciasDisponiveis = [];
let pedidosDisponiveis = [];
let motoristasDisponiveis = [];
let rotasDisponiveis = [];

// ---------------------- VALIDAÇÕES E UTILITÁRIOS ----------------------

function encontrarItem(lista, valor, campoId = 'id', campoNome = 'nome') {
    if (!valor || !lista) return null;
    
    const id = Number(valor);
    if (!isNaN(id)) {
        return lista.find(item => item[campoId] === id);
    }
    
    const valorLower = valor.toString().toLowerCase().trim();
    return lista.find(item => 
        item[campoNome]?.toLowerCase().includes(valorLower)
    );
}

function validarHub(valor) {
    const hub = encontrarItem(hubsData, valor);
    return {
        valido: !!hub,
        hub: hub,
        erro: hub ? null : 'Hub não encontrado. Use ID ou nome completo.'
    };
}

function validarMotorista(valor) {
    const motorista = encontrarItem(motoristasDisponiveis, valor, 'id', 'nome');
    return {
        valido: !!motorista,
        motorista: motorista,
        erro: motorista ? null : 'Motorista não encontrado. Use ID ou nome completo.'
    };
}

function validarConferencia(valor) {
    const id = Number(valor);
    if (isNaN(id)) {
        return { valido: false, erro: 'ID da conferência deve ser numérico' };
    }
    
    const conferencia = conferenciasDisponiveis.find(c => c.id === id);
    return {
        valido: !!conferencia,
        conferencia: conferencia,
        erro: conferencia ? null : 'Conferência não encontrada. Use o ID numérico.'
    };
}

function validarRota(valor) {
    const id = Number(valor);
    if (isNaN(id)) {
        return { valido: false, erro: 'ID da rota deve ser numérico' };
    }
    
    const rota = rotasDisponiveis.find(r => r.id === id);
    return {
        valido: !!rota,
        rota: rota,
        erro: rota ? null : 'Rota não encontrada. Use o ID numérico.'
    };
}

function validarNumeroPositivo(valor, campo) {
    const num = Number(valor);
    if (isNaN(num) || num <= 0) {
        return { valido: false, erro: `${campo} deve ser um número maior que zero` };
    }
    return { valido: true, valor: num };
}

function formatarData(dataString) {
    if (!dataString) return '-';
    try {
        return new Date(dataString).toLocaleString('pt-BR');
    } catch {
        return dataString;
    }
}

function mostrarCarregamento(mostrar) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = mostrar ? 'block' : 'none';
}

function mostrarFeedback(mensagem, tipo = 'info') {
    const feedback = document.getElementById('feedback-message');
    const feedbackText = document.getElementById('feedback-text');
    
    if (!feedback || !feedbackText) return;
    
    feedback.className = `alert alert-${tipo === 'success' ? 'success' : tipo === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
    feedbackText.textContent = mensagem;
    feedback.style.display = 'block';
    
    setTimeout(() => feedback.style.display = 'none', 5000);
}

// ---------------------- FUNÇÕES DE API ----------------------

async function apiRequest(path, method = 'GET', data = null, query = null) {
    try {
        const url = new URL(API_BASE_URL + path);
        if (query) {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.append(k, v);
            });
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            throw new Error('Token de autenticação não encontrado');
        }

        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            opts.body = JSON.stringify(data);
        }

        const res = await fetch(url.toString(), opts);

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            window.location.href = '/login';
            throw new Error('Sessão expirada');
        }

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        return res.status === 204 ? null : await res.json();
    } catch (err) {
        console.error('Erro na requisição API:', err);
        throw err;
    }
}

// ---------------------- CARREGAMENTO DE DADOS ----------------------

async function carregarTransportes(filtros = {}, page = 1) {
    try {
        mostrarCarregamento(true);
        
        const params = { ...filtros };
        if (params.numero) params.numero = params.numero.toUpperCase();
        
        const data = await apiRequest('/transportes', 'GET', null, params);
        transportesData = Array.isArray(data) ? data : [];

        totalPages = Math.max(1, Math.ceil(transportesData.length / PAGE_SIZE));
        currentPage = Math.min(Math.max(1, page), totalPages);

        renderizarTransportes();
        atualizarCardsResumo();
    } catch (err) {
        console.error('Erro ao carregar transportes:', err);
        mostrarFeedback(`Erro ao carregar dados: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function carregarDadosAuxiliares() {
    try {
        mostrarCarregamento(true);
        
        const [hubs, conferencias, motoristas, rotas, pedidos] = await Promise.all([
            apiRequest('/transportes/hubs-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/conferencias-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/motoristas-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/rotas-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/pedidos-disponiveis', 'GET').catch(() => [])
        ]);

        hubsData = hubs || [];
        conferenciasDisponiveis = conferencias || [];
        motoristasDisponiveis = motoristas || [];
        rotasDisponiveis = rotas || [];
        pedidosDisponiveis = pedidos || [];

        if (hubsData.length === 0) {
            usarDadosExemplo();
        }

    } catch (err) {
        console.error('Erro ao carregar dados auxiliares:', err);
        usarDadosExemplo();
    } finally {
        mostrarCarregamento(false);
    }
}

function usarDadosExemplo() {
    hubsData = [
        { id: 1, nome: 'Hub São Paulo' },
        { id: 2, nome: 'Hub Rio de Janeiro' },
        { id: 3, nome: 'Hub Belo Horizonte' }
    ];
    
    motoristasDisponiveis = [
        { id: 1, nome: 'João Silva', veiculo: 'Ford F-1000' },
        { id: 2, nome: 'Maria Santos', veiculo: 'Volkswagen Delivery' }
    ];
    
    conferenciasDisponiveis = [
        { id: 101, nome_estacao: 'Estação Alpha', status: 'PENDENTE' },
        { id: 102, nome_estacao: 'Estação Beta', status: 'CONCLUIDO' }
    ];
    
    rotasDisponiveis = [
        { id: 1001, cluster: 'Centro', motorista: { nome: 'João Silva' }, status_rota: 'CRIADA', numero_paradas: 5 }
    ];
    
    pedidosDisponiveis = [];
}

// ---------------------- RENDERIZAÇÃO ----------------------

function renderizarTransportes() {
    const tbody = document.getElementById('tabela-transportes');
    if (!tbody) return;

    if (transportesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center">Nenhum transporte encontrado</td></tr>';
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const transportesPagina = transportesData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = transportesPagina.map(transporte => {
        const status = STATUS_TRANSPORTE[transporte.status_transporte] || 
                      { class: 'badge-secondary', text: transporte.status_transporte };
        
        return `
            <tr data-id="${transporte.id}">
                <td>${transporte.numero_transporte || '-'}</td>
                <td>${transporte.tipo_transporte || '-'}</td>
                <td>${transporte.direcao || '-'}</td>
                <td>${transporte.hubOrigem?.nome || '-'}</td>
                <td>${transporte.hubDestino?.nome || '-'}</td>
                <td>${transporte.motorista?.nome || '-'}</td>
                <td>${transporte.conferencia ? `#${transporte.conferencia.id}` : '-'}</td>
                <td>${transporte.rota ? `#${transporte.rota.id}` : '-'}</td>
                <td>${transporte.quantidade_total || 0}</td>
                <td>${transporte.peso_total || 0}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>${formatarData(transporte.data_criacao)}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-info btn-view" data-id="${transporte.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning btn-edit" data-id="${transporte.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${transporte.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${!transporte.rota ? 
                        `<button class="btn btn-sm btn-success btn-criar-rota" data-id="${transporte.id}">
                            <i class="fas fa-route"></i>
                        </button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    renderizarPaginacao();
}

function renderizarPaginacao() {
    const container = document.querySelector('.card-footer');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <ul class="pagination pagination-sm m-0 float-right">
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">«</a>
            </li>
            ${Array.from({length: totalPages}, (_, i) => i + 1).map(page => `
                <li class="page-item ${page === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${page}">${page}</a>
                </li>
            `).join('')}
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">»</a>
            </li>
        </ul>
    `;
}

function atualizarCardsResumo() {
    const contadores = {
        'CRIADO': 0,
        'EM_TRANSPORTE': 0,
        'RECEBIDO': 0,
        'CANCELADO': 0
    };

    transportesData.forEach(t => {
        if (contadores[t.status_transporte] !== undefined) {
            contadores[t.status_transporte]++;
        }
    });

    document.getElementById('total-criados').textContent = contadores.CRIADO;
    document.getElementById('total-transporte').textContent = contadores.EM_TRANSPORTE;
    document.getElementById('total-recebidos').textContent = contadores.RECEBIDO;
    document.getElementById('total-cancelados').textContent = contadores.CANCELADO;
}

// ---------------------- MODAIS - FUNÇÕES DE ABERTURA ----------------------

function abrirModalNovoTransporte() {
    currentTransporteId = null;
    
    // Limpar formulário
    document.getElementById('transporte-tipo').value = '';
    document.getElementById('transporte-direcao').value = '';
    document.getElementById('transporte-origem').value = '';
    document.getElementById('transporte-destino').value = '';
    document.getElementById('transporte-quantidade').value = '';
    document.getElementById('transporte-peso').value = '';
    document.getElementById('transporte-volumetria').value = '';
    document.getElementById('transporte-observacoes').value = '';
    document.getElementById('transporte-conferencias').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modal-novo-transporte'));
    modal.show();
}

async function abrirDetalhesTransporte(id) {
    try {
        mostrarCarregamento(true);
        const resposta = await apiRequest(`/transportes/${id}/detalhes`);
        const transporte = resposta.transporte;
        const pedidos = resposta.pedidos || [];
        
        currentTransporteId = id;

        // Preencher informações básicas
        document.getElementById('detalhe-numero').value = transporte.numero_transporte || '-';
        document.getElementById('detalhe-tipo').value = transporte.tipo_transporte || '-';
        document.getElementById('detalhe-direcao').value = transporte.direcao || '-';
        
        const status = STATUS_TRANSPORTE[transporte.status_transporte] || { text: transporte.status_transporte };
        document.getElementById('detalhe-status').value = status.text;

        // Preencher informações de rota
        document.getElementById('detalhe-origem').value = transporte.hubOrigem?.nome || '-';
        document.getElementById('detalhe-destino').value = transporte.hubDestino?.nome || '-';
        document.getElementById('detalhe-motorista').value = transporte.motorista?.nome || '-';
        document.getElementById('detalhe-veiculo').value = transporte.motorista?.veiculo || '-';

        // Preencher informações de carga
        document.getElementById('detalhe-quantidade').value = transporte.quantidade_total || 0;
        document.getElementById('detalhe-peso').value = transporte.peso_total || 0;
        document.getElementById('detalhe-volumetria').value = transporte.volumetria_total || 0;

        // Preencher datas
        document.getElementById('detalhe-criacao').value = formatarData(transporte.data_criacao);
        document.getElementById('detalhe-inicio').value = formatarData(transporte.data_inicio);
        document.getElementById('detalhe-conclusao').value = formatarData(transporte.data_conclusao);

        // Preencher conferência associada
        if (transporte.conferencia) {
            const statusConf = STATUS_CONFERENCIA[transporte.conferencia.status] || { text: transporte.conferencia.status };
            document.getElementById('detalhe-conferencia-id').textContent = `#${transporte.conferencia.id}`;
            document.getElementById('detalhe-conferencia-status').textContent = statusConf.text;
            document.getElementById('detalhe-conferencia-estacao').textContent = transporte.conferencia.nome_estacao || '';
        } else {
            document.getElementById('detalhe-conferencia-id').textContent = 'Nenhuma conferência associada';
            document.getElementById('detalhe-conferencia-status').textContent = '';
            document.getElementById('detalhe-conferencia-estacao').textContent = '';
        }

        // Preencher rota associada
        if (transporte.rota) {
            const statusRota = STATUS_ROTA[transporte.rota.status_rota] || { text: transporte.rota.status_rota };
            document.getElementById('detalhe-rota-id').textContent = `Rota #${transporte.rota.id}`;
            document.getElementById('detalhe-rota-status').textContent = statusRota.text;
            document.getElementById('detalhe-rota-cluster').textContent = transporte.rota.cluster || '';
            document.getElementById('detalhe-rota-paradas').textContent = `${transporte.rota.numero_paradas || 0} paradas`;
        } else {
            document.getElementById('detalhe-rota-id').textContent = 'Nenhuma rota associada';
            document.getElementById('detalhe-rota-status').textContent = '';
            document.getElementById('detalhe-rota-cluster').textContent = '';
            document.getElementById('detalhe-rota-paradas').textContent = '';
        }

        // Preencher pedidos
        preencherPedidosTransporte(pedidos);

        // Configurar botões de ação
        configurarBotoesDetalhes(transporte);

        const modal = new bootstrap.Modal(document.getElementById('modal-detalhes'));
        modal.show();
    } catch (err) {
        console.error('Erro ao carregar detalhes:', err);
        mostrarFeedback(`Erro ao carregar detalhes: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

function preencherPedidosTransporte(pedidos) {
    const tbody = document.getElementById('detalhe-pedidos');
    if (!tbody) return;

    if (!pedidos || pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum pedido associado</td></tr>';
        return;
    }

    tbody.innerHTML = pedidos.map(pedido => `
        <tr>
            <td>${pedido.codigo_pedido || pedido.id}</td>
            <td>${pedido.cliente?.nome || '-'}</td>
            <td>${pedido.produto?.nome || '-'}</td>
            <td>${pedido.status || '-'}</td>
            <td>${pedido.endereco ? `${pedido.endereco.cidade} - ${pedido.endereco.estado}` : '-'}</td>
        </tr>
    `).join('');
}

function configurarBotoesDetalhes(transporte) {
    // Botão Ver Pedidos
    document.getElementById('btn-ver-pedidos').onclick = () => {
        const painel = document.getElementById('painel-pedidos');
        painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
    };

    // Botão Atribuir Motorista
    document.getElementById('btn-atribuir-motorista').onclick = () => {
        abrirModalAtribuirMotorista(transporte.id);
    };

    // Botão Atribuir Rota
    document.getElementById('btn-atribuir-rota').onclick = () => {
        abrirModalAtribuirRota(transporte.id);
    };

    // Botão Criar Rota (só mostra se não tiver rota)
    const btnCriarRota = document.getElementById('btn-criar-rota');
    btnCriarRota.style.display = transporte.rota ? 'none' : 'block';
    btnCriarRota.onclick = () => {
        abrirModalCriarRota(transporte.id);
    };

    // Botões de status
    const btnIniciar = document.getElementById('btn-iniciar-transporte');
    const btnFinalizar = document.getElementById('btn-finalizar-transporte');
    
    if (transporte.status_transporte === 'CRIADO') {
        btnIniciar.style.display = 'block';
        btnFinalizar.style.display = 'none';
        btnIniciar.onclick = () => iniciarTransporte(transporte.id);
    } else if (transporte.status_transporte === 'EM_TRANSPORTE') {
        btnIniciar.style.display = 'none';
        btnFinalizar.style.display = 'block';
        btnFinalizar.onclick = () => finalizarTransporte(transporte.id);
    } else {
        btnIniciar.style.display = 'none';
        btnFinalizar.style.display = 'none';
    }

    // Botão Associar Conferência
    document.getElementById('btn-associar-conferencia').onclick = () => {
        abrirModalAssociarConferencia(transporte.id);
    };

    // Botão Associar Pedidos
    document.getElementById('btn-associar-pedidos').onclick = () => {
        abrirModalAssociarPedidos(transporte.id);
    };

    // Botão Editar
    document.getElementById('btn-editar').onclick = () => {
        abrirEdicaoTransporte(transporte);
    };
}

function abrirEdicaoTransporte(transporte) {
    currentTransporteId = transporte.id;
    
    // Preencher formulário de edição
    document.getElementById('editar-id').value = transporte.id;
    document.getElementById('editar-tipo').value = transporte.tipo_transporte || '';
    document.getElementById('editar-direcao').value = transporte.direcao || '';
    document.getElementById('editar-origem').value = transporte.hubOrigem?.nome || '';
    document.getElementById('editar-destino').value = transporte.hubDestino?.nome || '';
    document.getElementById('editar-motorista').value = transporte.motorista?.nome || '';
    document.getElementById('editar-veiculo').value = transporte.motorista?.veiculo || '';
    document.getElementById('editar-quantidade').value = transporte.quantidade_total || '';
    document.getElementById('editar-peso').value = transporte.peso_total || '';
    document.getElementById('editar-volumetria').value = transporte.volumetria_total || '';
    document.getElementById('editar-observacoes').value = transporte.observacoes || '';

    // Preencher informações de conferência e rota
    if (transporte.conferencia) {
        document.getElementById('editar-conferencia-id').textContent = `#${transporte.conferencia.id}`;
        document.getElementById('editar-conferencia-status').textContent = transporte.conferencia.status;
        document.getElementById('editar-conferencia-estacao').textContent = transporte.conferencia.nome_estacao || '';
    } else {
        document.getElementById('editar-conferencia-id').textContent = 'Nenhuma conferência associada';
        document.getElementById('editar-conferencia-status').textContent = '';
        document.getElementById('editar-conferencia-estacao').textContent = '';
    }

    if (transporte.rota) {
        document.getElementById('editar-rota-id').textContent = `Rota #${transporte.rota.id}`;
        document.getElementById('editar-rota-status-badge').textContent = transporte.rota.status_rota;
        document.getElementById('editar-rota-cluster').textContent = transporte.rota.cluster || '';
        document.getElementById('editar-rota-paradas').textContent = `${transporte.rota.numero_paradas || 0} paradas`;
    } else {
        document.getElementById('editar-rota-id').textContent = 'Nenhuma rota associada';
        document.getElementById('editar-rota-status-badge').textContent = '';
        document.getElementById('editar-rota-cluster').textContent = '';
        document.getElementById('editar-rota-paradas').textContent = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-editar-transporte'));
    modal.show();
}

function abrirModalAtribuirMotorista(idTransporte) {
    currentTransporteId = idTransporte;
    const modal = new bootstrap.Modal(document.getElementById('modal-atribuir-motorista'));
    modal.show();
}

function abrirModalAtribuirRota(idTransporte) {
    currentTransporteId = idTransporte;
    const modal = new bootstrap.Modal(document.getElementById('modal-atribuir-rota'));
    modal.show();
}

function abrirModalCriarRota(idTransporte) {
    currentTransporteId = idTransporte;
    
    // Carregar pedidos para a rota
    carregarPedidosParaRota(idTransporte);
    
    const modal = new bootstrap.Modal(document.getElementById('modal-criar-rota'));
    modal.show();
}

function abrirModalAssociarConferencia(idTransporte) {
    currentTransporteId = idTransporte;
    const modal = new bootstrap.Modal(document.getElementById('modal-associar-conferencia'));
    modal.show();
}

function abrirModalAssociarPedidos(idTransporte) {
    currentTransporteId = idTransporte;
    
    // Carregar pedidos disponíveis
    popularTabelaPedidosDisponiveis();
    
    const modal = new bootstrap.Modal(document.getElementById('modal-associar-pedidos'));
    modal.show();
}

// ---------------------- FUNÇÕES DE CARREGAMENTO AUXILIAR ----------------------

async function carregarPedidosParaRota(idTransporte) {
    try {
        const pedidos = await apiRequest(`/transportes/${idTransporte}/pedidos-rota`);
        popularTabelaPedidosRota(pedidos);
    } catch (err) {
        console.error('Erro ao carregar pedidos para rota:', err);
        document.getElementById('tabela-pedidos-rota').innerHTML = 
            '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar pedidos</td></tr>';
    }
}

function popularTabelaPedidosRota(pedidos) {
    const tbody = document.getElementById('tabela-pedidos-rota');
    if (!tbody) return;

    if (!pedidos || pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum pedido disponível</td></tr>';
        return;
    }

    tbody.innerHTML = pedidos.map(pedido => `
        <tr>
            <td><input type="checkbox" class="pedido-rota-checkbox" value="${pedido.id}"></td>
            <td>${pedido.codigo_pedido || pedido.id}</td>
            <td>${pedido.cliente?.nome || '-'}</td>
            <td>${pedido.produto?.nome || '-'}</td>
            <td><span class="badge bg-info">${pedido.status || '-'}</span></td>
            <td>${pedido.endereco ? `${pedido.endereco.cidade} - ${pedido.endereco.estado}` : '-'}</td>
        </tr>
    `).join('');

    // Configurar selecionar todos
    document.getElementById('selecionar-todos-pedidos-rota').onchange = function() {
        tbody.querySelectorAll('.pedido-rota-checkbox').forEach(cb => {
            cb.checked = this.checked;
        });
    };
}

function popularTabelaPedidosDisponiveis() {
    const tbody = document.getElementById('tabela-pedidos-disponiveis');
    if (!tbody) return;

    if (!pedidosDisponiveis || pedidosDisponiveis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum pedido disponível</td></tr>';
        return;
    }

    tbody.innerHTML = pedidosDisponiveis.map(pedido => `
        <tr>
            <td><input type="checkbox" class="pedido-checkbox" value="${pedido.id}"></td>
            <td>${pedido.codigo_pedido || pedido.id}</td>
            <td>${pedido.cliente?.nome || '-'}</td>
            <td>${pedido.produto?.nome || '-'}</td>
            <td>${pedido.status || '-'}</td>
            <td>${pedido.endereco ? `${pedido.endereco.cidade} - ${pedido.endereco.estado}` : '-'}</td>
        </tr>
    `).join('');

    // Configurar selecionar todos
    document.getElementById('selecionar-todos').onchange = function() {
        tbody.querySelectorAll('.pedido-checkbox').forEach(cb => {
            cb.checked = this.checked;
        });
    };

    // Configurar filtro
    document.getElementById('filtro-pedidos').oninput = function() {
        const filtro = this.value.toLowerCase();
        tbody.querySelectorAll('tr').forEach(linha => {
            const texto = linha.textContent.toLowerCase();
            linha.style.display = texto.includes(filtro) ? '' : 'none';
        });
    };
}

// ---------------------- AÇÕES PRINCIPAIS ----------------------

async function criarNovoTransporte() {
    const dados = {
        tipo_transporte: document.getElementById('transporte-tipo').value,
        direcao: document.getElementById('transporte-direcao').value,
        quantidade_total: document.getElementById('transporte-quantidade').value,
        peso_total: document.getElementById('transporte-peso').value,
        volumetria_total: document.getElementById('transporte-volumetria').value,
        observacoes: document.getElementById('transporte-observacoes').value
    };

    // Validar hubs
    const origemInput = document.getElementById('transporte-origem').value;
    const destinoInput = document.getElementById('transporte-destino').value;
    
    const validacaoOrigem = validarHub(origemInput);
    const validacaoDestino = validarHub(destinoInput);

    if (!validacaoOrigem.valido || !validacaoDestino.valido) {
        mostrarFeedback(validacaoOrigem.erro || validacaoDestino.erro, 'error');
        return;
    }

    dados.hub_origem_id = validacaoOrigem.hub.id;
    dados.hub_destino_id = validacaoDestino.hub.id;

    // Validar números
    const validacaoQuantidade = validarNumeroPositivo(dados.quantidade_total, 'Quantidade');
    const validacaoPeso = validarNumeroPositivo(dados.peso_total, 'Peso');
    const validacaoVolumetria = validarNumeroPositivo(dados.volumetria_total, 'Volumetria');

    if (!validacaoQuantidade.valido || !validacaoPeso.valido || !validacaoVolumetria.valido) {
        mostrarFeedback(validacaoQuantidade.erro || validacaoPeso.erro || validacaoVolumetria.erro, 'error');
        return;
    }

    dados.quantidade_total = validacaoQuantidade.valor;
    dados.peso_total = validacaoPeso.valor;
    dados.volumetria_total = validacaoVolumetria.valor;

    try {
        mostrarCarregamento(true);
        await apiRequest('/transportes', 'POST', dados);
        
        mostrarFeedback('Transporte criado com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-novo-transporte')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao criar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function salvarEdicaoTransporte() {
    const transporteId = document.getElementById('editar-id').value;
    if (!transporteId) return;

    const dados = {
        tipo_transporte: document.getElementById('editar-tipo').value,
        direcao: document.getElementById('editar-direcao').value,
        quantidade_total: document.getElementById('editar-quantidade').value,
        peso_total: document.getElementById('editar-peso').value,
        volumetria_total: document.getElementById('editar-volumetria').value,
        observacoes: document.getElementById('editar-observacoes').value
    };

    // Validar hubs
    const origemInput = document.getElementById('editar-origem').value;
    const destinoInput = document.getElementById('editar-destino').value;
    
    const validacaoOrigem = validarHub(origemInput);
    const validacaoDestino = validarHub(destinoInput);

    if (!validacaoOrigem.valido || !validacaoDestino.valido) {
        mostrarFeedback(validacaoOrigem.erro || validacaoDestino.erro, 'error');
        return;
    }

    dados.hub_origem_id = validacaoOrigem.hub.id;
    dados.hub_destino_id = validacaoDestino.hub.id;

    // Validar números
    const validacaoQuantidade = validarNumeroPositivo(dados.quantidade_total, 'Quantidade');
    const validacaoPeso = validarNumeroPositivo(dados.peso_total, 'Peso');
    const validacaoVolumetria = validarNumeroPositivo(dados.volumetria_total, 'Volumetria');

    if (!validacaoQuantidade.valido || !validacaoPeso.valido || !validacaoVolumetria.valido) {
        mostrarFeedback(validacaoQuantidade.erro || validacaoPeso.erro || validacaoVolumetria.erro, 'error');
        return;
    }

    dados.quantidade_total = validacaoQuantidade.valor;
    dados.peso_total = validacaoPeso.valor;
    dados.volumetria_total = validacaoVolumetria.valor;

    // Validar motorista (opcional)
    const motoristaInput = document.getElementById('editar-motorista').value;
    if (motoristaInput) {
        const validacaoMotorista = validarMotorista(motoristaInput);
        if (!validacaoMotorista.valido) {
            mostrarFeedback(validacaoMotorista.erro, 'error');
            return;
        }
        dados.motorista_id = validacaoMotorista.motorista.id;
    }

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${transporteId}`, 'PUT', dados);
        
        mostrarFeedback('Transporte atualizado com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-editar-transporte')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao atualizar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function atribuirMotorista() {
    const motoristaInput = document.getElementById('select-motorista').value;
    
    const validacao = validarMotorista(motoristaInput);
    if (!validacao.valido) {
        mostrarFeedback(validacao.erro, 'error');
        return;
    }

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${currentTransporteId}/atribuir-motorista`, 'POST', {
            motorista_id: validacao.motorista.id
        });
        
        mostrarFeedback('Motorista atribuído com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-atribuir-motorista')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao atribuir motorista: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function atribuirRota() {
    const rotaInput = document.getElementById('select-rota').value;
    
    const validacao = validarRota(rotaInput);
    if (!validacao.valido) {
        mostrarFeedback(validacao.erro, 'error');
        return;
    }

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${currentTransporteId}/atribuir-rota`, 'POST', {
            rota_id: validacao.rota.id
        });
        
        mostrarFeedback('Rota atribuída com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-atribuir-rota')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao atribuir rota: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function criarRota() {
    const cluster = document.getElementById('rota-cluster').value;
    const motoristaInput = document.getElementById('rota-motorista').value;
    
    if (!cluster) {
        mostrarFeedback('Informe o cluster da rota', 'error');
        return;
    }

    const validacaoMotorista = validarMotorista(motoristaInput);
    if (!validacaoMotorista.valido) {
        mostrarFeedback(validacaoMotorista.erro, 'error');
        return;
    }

    // Obter pedidos selecionados
    const pedidosSelecionados = [];
    document.querySelectorAll('.pedido-rota-checkbox:checked').forEach(cb => {
        pedidosSelecionados.push(parseInt(cb.value));
    });

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${currentTransporteId}/criar-rota`, 'POST', {
            cluster: cluster,
            motorista_id: validacaoMotorista.motorista.id,
            pedidos: pedidosSelecionados
        });
        
        mostrarFeedback('Rota criada com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-criar-rota')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao criar rota: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function associarConferencia() {
    const conferenciaInput = document.getElementById('select-conferencia').value;
    
    const validacao = validarConferencia(conferenciaInput);
    if (!validacao.valido) {
        mostrarFeedback(validacao.erro, 'error');
        return;
    }

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${currentTransporteId}/associar-conferencia`, 'POST', {
            conferencia_id: validacao.conferencia.id
        });
        
        mostrarFeedback('Conferência associada com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-associar-conferencia')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao associar conferência: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function associarPedidos() {
    const pedidosSelecionados = [];
    document.querySelectorAll('.pedido-checkbox:checked').forEach(cb => {
        pedidosSelecionados.push(parseInt(cb.value));
    });

    if (pedidosSelecionados.length === 0) {
        mostrarFeedback('Selecione pelo menos um pedido', 'error');
        return;
    }

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${currentTransporteId}/associar-pedidos`, 'POST', {
            pedidos_ids: pedidosSelecionados
        });
        
        mostrarFeedback('Pedidos associados com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-associar-pedidos')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao associar pedidos: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function iniciarTransporte(idTransporte) {
    if (!confirm('Deseja realmente iniciar este transporte?')) return;

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${idTransporte}/iniciar`, 'POST');
        
        mostrarFeedback('Transporte iniciado com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-detalhes')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao iniciar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function finalizarTransporte(idTransporte) {
    if (!confirm('Deseja realmente finalizar este transporte?')) return;

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${idTransporte}/finalizar`, 'POST');
        
        mostrarFeedback('Transporte finalizado com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modal-detalhes')).hide();
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao finalizar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function excluirTransporte(id) {
    if (!confirm('Tem certeza que deseja excluir este transporte?')) return;
    
    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${id}`, 'DELETE');
        mostrarFeedback('Transporte excluído com sucesso!', 'success');
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao excluir transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------------------- INICIALIZAÇÃO ----------------------

document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticação
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Carregar dados iniciais
    carregarTransportes();
    carregarDadosAuxiliares();

    // Event Listeners para botões principais
    document.getElementById('btn-criar-transporte')?.addEventListener('click', criarNovoTransporte);
    document.getElementById('btn-salvar-edicao')?.addEventListener('click', salvarEdicaoTransporte);
    document.getElementById('btn-confirmar-motorista')?.addEventListener('click', atribuirMotorista);
    document.getElementById('btn-confirmar-rota')?.addEventListener('click', atribuirRota);
    document.getElementById('btn-confirmar-criar-rota')?.addEventListener('click', criarRota);
    document.getElementById('btn-confirmar-conferencia')?.addEventListener('click', associarConferencia);
    document.getElementById('btn-confirmar-pedidos')?.addEventListener('click', associarPedidos);
    document.getElementById('btn-limpar-filtro-pedidos')?.addEventListener('click', function() {
        document.getElementById('filtro-pedidos').value = '';
        popularTabelaPedidosDisponiveis();
    });

    // Paginação
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('page-link')) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page)) {
                currentPage = page;
                renderizarTransportes();
            }
        }
    });

    // Delegation para botões da tabela
    document.getElementById('tabela-transportes')?.addEventListener('click', function(e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        const transporteId = btn.dataset.id;
        const acao = btn.classList[2];

        switch(acao) {
            case 'btn-view':
                abrirDetalhesTransporte(transporteId);
                break;
            case 'btn-edit':
                const transporte = transportesData.find(t => t.id == transporteId);
                if (transporte) abrirEdicaoTransporte(transporte);
                break;
            case 'btn-delete':
                excluirTransporte(transporteId);
                break;
            case 'btn-criar-rota':
                abrirModalCriarRota(transporteId);
                break;
        }
    });

    // Filtros
    document.getElementById('filtro-numero')?.addEventListener('input', atualizarFiltros);
    document.getElementById('filtro-tipo')?.addEventListener('change', atualizarFiltros);
    document.getElementById('filtro-direcao')?.addEventListener('change', atualizarFiltros);
    document.getElementById('filtro-status')?.addEventListener('change', atualizarFiltros);

    console.log('Sistema de transportes inicializado');
});

function atualizarFiltros() {
    const filtros = {
        numero: document.getElementById('filtro-numero')?.value || undefined,
        tipo: document.getElementById('filtro-tipo')?.value || undefined,
        direcao: document.getElementById('filtro-direcao')?.value || undefined,
        status: document.getElementById('filtro-status')?.value || undefined
    };

    Object.keys(filtros).forEach(k => { 
        if (!filtros[k]) delete filtros[k]; 
    });

    carregarTransportes(filtros, 1);
}

// Exportar funções globais
window.filtrarPorStatus = function(status) {
    document.getElementById('filtro-status').value = status;
    atualizarFiltros();
};

window.abrirModalNovoTransporte = abrirModalNovoTransporte;
window.abrirModalEditarTransporte = abrirEdicaoTransporte;
window.abrirModalAtribuirMotorista = abrirModalAtribuirMotorista;
window.abrirModalAtribuirRota = abrirModalAtribuirRota;
window.abrirModalCriarRota = abrirModalCriarRota;
window.abrirModalAssociarConferencia = abrirModalAssociarConferencia;
window.abrirModalAssociarPedidos = abrirModalAssociarPedidos;