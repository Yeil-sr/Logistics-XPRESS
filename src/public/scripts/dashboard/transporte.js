const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://logistics-xpress.vercel.app/';
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

function validarConferencia(valor) {
    const id = Number(valor);
    if (isNaN(id)) {
        return { valido: false, erro: 'ID da conferência deve ser numérico' };
    }
    
    const conferencias = conferenciasDisponiveis.find(c => c.id === id);
    return {
        valido: !!conferencias,
        conferencia: conferencias,
        erro: conferencias ? null : 'Conferência não encontrada. Use o ID numérico.'
    };
}

function validarRota(valor) {
    const id = Number(valor);
    if (isNaN(id)) {
        return { valido: false, erro: 'ID da rota deve ser numérico' };
    }
    
    const rotas = rotasDisponiveis.find(r => r.id === id);
    return {
        valido: !!rotas,
        rota: rotas,
        erro: rotas ? null : 'Rota não encontrada. Use o ID numérico.'
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
    
    setTimeout(() => {
        if (feedback.style.display !== 'none') {
            feedback.style.display = 'none';
        }
    }, 5000);
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
        
        const [hubs, conferencias, rotas, pedidos] = await Promise.all([
            apiRequest('/transportes/hubs-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/conferencias-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/rotas-disponiveis', 'GET').catch(() => []),
            apiRequest('/transportes/pedidos-disponiveis', 'GET').catch(() => [])
        ]);

        hubsData = hubs || [];
        conferenciasDisponiveis = conferencias || [];
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
    
    conferenciasDisponiveis = [
        { id: 101, nome_estacao: 'Estação Alpha', status: 'PENDENTE' },
        { id: 102, nome_estacao: 'Estação Beta', status: 'CONCLUIDO' }
    ];
    
    rotasDisponiveis = [
        { id: 1001, cluster: 'Centro', status_rota: 'CRIADA', numero_paradas: 5 }
    ];
    
    pedidosDisponiveis = [];
}

// ---------------------- RENDERIZAÇÃO ----------------------

function renderizarTransportes() {
    const tbody = document.getElementById('tabela-transportes');
    if (!tbody) return;

    if (transportesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhum transporte encontrado</td></tr>';
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const transportesPagina = transportesData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = transportesPagina.map(transporte => {
        const status = STATUS_TRANSPORTE[transporte.status_transporte] || 
                      { class: 'badge-secondary', text: transporte.status_transporte };
        
        // Botão de cancelamento só para transportes que podem ser cancelados
        const podeCancelar = transporte.status_transporte === 'CRIADO' || 
                           transporte.status_transporte === 'EM_TRANSPORTE';
        
        return `
            <tr data-id="${transporte.id}">
                <td>${transporte.numero_transporte || '-'}</td>
                <td>${transporte.tipo_transporte || '-'}</td>
                <td>${transporte.direcao || '-'}</td>
                <td>${transporte.hubOrigem?.nome || '-'}</td>
                <td>${transporte.hubDestino?.nome || '-'}</td>
                <td>${transporte.conferencias ? `#${transporte.conferencias.id}` : '-'}</td>
                <td>${transporte.rotas ? `#${transporte.rotas.id}` : '-'}</td>
                <td>${transporte.quantidade_total || 0}</td>
                <td>${transporte.peso_total_kg || 0}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>${formatarData(transporte.data_criacao)}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-info btn-view" data-id="${transporte.id}" data-action="view">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning btn-edit" data-id="${transporte.id}" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${podeCancelar ? 
                        `<button class="btn btn-sm btn-danger btn-cancel" data-id="${transporte.id}" data-action="cancel">
                            <i class="fas fa-times"></i>
                        </button>` : ''}
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${transporte.id}" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${!transporte.rotas ? 
                        `<button class="btn btn-sm btn-success btn-criar-rota" data-id="${transporte.id}" data-action="criar-rota">
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

    const totalCriados = document.getElementById('total-criados');
    const totalTransporte = document.getElementById('total-transporte');
    const totalRecebidos = document.getElementById('total-recebidos');
    const totalCancelados = document.getElementById('total-cancelados');

    if (totalCriados) totalCriados.textContent = contadores.CRIADO;
    if (totalTransporte) totalTransporte.textContent = contadores.EM_TRANSPORTE;
    if (totalRecebidos) totalRecebidos.textContent = contadores.RECEBIDO;
    if (totalCancelados) totalCancelados.textContent = contadores.CANCELADO;
}

// ---------------------- MODAIS - FUNÇÕES DE ABERTURA ----------------------

function abrirModalNovoTransporte() {
    currentTransporteId = null;
    
    // Limpar formulário
    const form = document.getElementById('form-transporte');
    if (form) form.reset();
    
    $('#modal-novo-transporte').modal('show');
}

async function abrirDetalhesTransporte(id) {
    try {
        mostrarCarregamento(true);
        const transporte = await apiRequest(`/transportes/${id}`);
        const pedidos = await apiRequest(`/transportes/${id}/pedidos`) || [];
        
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
        document.getElementById('detalhe-veiculo').value = transporte.placa_veiculo || '-';

        // Preencher informações de carga
        document.getElementById('detalhe-quantidade').value = transporte.quantidade_total || 0;
        document.getElementById('detalhe-peso').value = transporte.peso_total_kg || 0;
        document.getElementById('detalhe-volumetria').value = transporte.volumetria_total || 0;

        // Preencher datas
        document.getElementById('detalhe-criacao').value = formatarData(transporte.data_criacao);
        document.getElementById('detalhe-inicio').value = formatarData(transporte.data_inicio);
        document.getElementById('detalhe-conclusao').value = formatarData(transporte.data_conclusao);

        // Preencher conferência associada
        if (transporte.conferencias) {
            const statusConf = STATUS_CONFERENCIA[transporte.conferencias.status] || { text: transporte.conferencias.status };
            document.getElementById('detalhe-conferencia-id').textContent = `#${transporte.conferencias.id}`;
            document.getElementById('detalhe-conferencia-status').textContent = statusConf.text;
            document.getElementById('detalhe-conferencia-estacao').textContent = transporte.conferencias.nome_estacao || '';
        } else {
            document.getElementById('detalhe-conferencia-id').textContent = 'Nenhuma conferência associada';
            document.getElementById('detalhe-conferencia-status').textContent = '';
            document.getElementById('detalhe-conferencia-estacao').textContent = '';
        }

        // Preencher rota associada
        if (transporte.rotas) {
            const statusRota = STATUS_ROTA[transporte.rotas.status_rota] || { text: transporte.rotas.status_rota };
            document.getElementById('detalhe-rota-id').textContent = `Rota #${transporte.rotas.id}`;
            document.getElementById('detalhe-rota-status').textContent = statusRota.text;
            document.getElementById('detalhe-rota-cluster').textContent = transporte.rotas.cluster || '';
            document.getElementById('detalhe-rota-paradas').textContent = `${transporte.rotas.numero_paradas || 0} paradas`;
        } else {
            document.getElementById('detalhe-rota-id').textContent = 'Nenhuma rota associada';
            document.getElementById('detalhe-rota-status').textContent = '';
            document.getElementById('detalhe-rota-cluster').textContent = '';
            document.getElementById('detalhe-rota-paradas').textContent = '';
        }

        preencherPedidosTransporte(pedidos);

        configurarBotoesDetalhes(transporte);

        $('#modal-detalhes').modal('show');
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
            <td>${pedido.clientes?.nome || '-'}</td>
            <td>${pedido.produtos?.nome || '-'}</td>
            <td>${pedido.status || '-'}</td>
            <td>${pedido.enderecos ? `${pedido.enderecos.cidade} - ${pedido.enderecos.estado}` : '-'}</td>
        </tr>
    `).join('');
}

function configurarBotoesDetalhes(transporte) {
    const btnVerPedidos = document.getElementById('btn-ver-pedidos');
    if (btnVerPedidos) {
        btnVerPedidos.onclick = () => {
            const painel = document.getElementById('painel-pedidos');
            painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
        };
    }

    const btnAtribuirRota = document.getElementById('btn-atribuir-rota');
    if (btnAtribuirRota) {
        btnAtribuirRota.onclick = () => {
            abrirModalAtribuirRota(transporte.id);
        };
    }
    const btnCriarRota = document.getElementById('btn-criar-rota');
    if (btnCriarRota) {
        btnCriarRota.style.display = transporte.rotas ? 'none' : 'block';
        btnCriarRota.onclick = () => {
            abrirModalCriarRota(transporte.id);
        };
    }

    const btnIniciar = document.getElementById('btn-iniciar-transporte');
    const btnConcluir = document.getElementById('btn-concluir-transporte');
    
    if (btnIniciar && btnConcluir) {
        if (transporte.status_transporte === 'CRIADO') {
            btnIniciar.style.display = 'block';
            btnConcluir.style.display = 'none';
            btnIniciar.onclick = () => iniciarTransporte(transporte.id);
        } else if (transporte.status_transporte === 'EM_TRANSPORTE') {
            btnIniciar.style.display = 'none';
            btnConcluir.style.display = 'block';
            btnConcluir.onclick = () => finalizarTransporte(transporte.id);
        } else {
            btnIniciar.style.display = 'none';
            btnConcluir.style.display = 'none';
        }
    }

    const btnAssociarConferencia = document.getElementById('btn-associar-conferencia');
    if (btnAssociarConferencia) {
        btnAssociarConferencia.onclick = () => {
            abrirModalAssociarConferencia(transporte.id);
        };
    }

    const btnAssociarPedidos = document.getElementById('btn-associar-pedidos');
    if (btnAssociarPedidos) {
        btnAssociarPedidos.onclick = () => {
            abrirModalAssociarPedidos(transporte.id);
        };
    }

    const btnEditar = document.getElementById('btn-editar');
    if (btnEditar) {
        btnEditar.onclick = () => {
            abrirEdicaoTransporte(transporte);
        };
    }
}

function abrirEdicaoTransporte(transporte) {
    currentTransporteId = transporte.id;
    
    document.getElementById('editar-id').value = transporte.id;
    document.getElementById('editar-tipo').value = transporte.tipo_transporte || '';
    document.getElementById('editar-direcao').value = transporte.direcao || '';
    document.getElementById('editar-origem').value = transporte.hubOrigem?.nome || '';
    document.getElementById('editar-destino').value = transporte.hubDestino?.nome || '';
    document.getElementById('editar-veiculo').value = transporte.placa_veiculo || '';
    document.getElementById('editar-quantidade').value = transporte.quantidade_total || '';
    document.getElementById('editar-peso').value = transporte.peso_total_kg || '';
    document.getElementById('editar-volumetria').value = transporte.volumetria_total || '';
    document.getElementById('editar-observacoes').value = transporte.observacoes || '';

    if (transporte.conferencias) {
        document.getElementById('editar-conferencia-id').textContent = `#${transporte.conferencias.id}`;
        document.getElementById('editar-conferencia-status').textContent = transporte.conferencias.status;
        document.getElementById('editar-conferencia-estacao').textContent = transporte.conferencias.nome_estacao || '';
    } else {
        document.getElementById('editar-conferencia-id').textContent = 'Nenhuma conferência associada';
        document.getElementById('editar-conferencia-status').textContent = '';
        document.getElementById('editar-conferencia-estacao').textContent = '';
    }

    if (transporte.rotas) {
        document.getElementById('editar-rota-id').textContent = `Rota #${transporte.rotas.id}`;
        document.getElementById('editar-rota-status-badge').textContent = transporte.rotas.status_rota;
        document.getElementById('editar-rota-cluster').textContent = transporte.rotas.cluster || '';
        document.getElementById('editar-rota-paradas').textContent = `${transporte.rotas.numero_paradas || 0} paradas`;
    } else {
        document.getElementById('editar-rota-id').textContent = 'Nenhuma rota associada';
        document.getElementById('editar-rota-status-badge').textContent = '';
        document.getElementById('editar-rota-cluster').textContent = '';
        document.getElementById('editar-rota-paradas').textContent = '';
    }

    $('#modal-editar-transporte').modal('show');
}

function abrirModalAtribuirRota(idTransporte) {
    currentTransporteId = idTransporte;
    $('#modal-atribuir-rota').modal('show');
}

function abrirModalCriarRota(idTransporte) {
    currentTransporteId = idTransporte;
    
    carregarPedidosParaRota(idTransporte);
    
    $('#modal-criar-rota').modal('show');
}

function abrirModalAssociarConferencia(idTransporte) {
    currentTransporteId = idTransporte;
    $('#modal-associar-conferencia').modal('show');
}

function abrirModalAssociarPedidos(idTransporte) {
    currentTransporteId = idTransporte;
    
    popularTabelaPedidosDisponiveis();
    
    $('#modal-associar-pedidos').modal('show');
}

// ---------------------- FUNÇÕES DE CARREGAMENTO AUXILIAR ----------------------

async function carregarPedidosParaRota(idTransporte) {
    try {
        const pedidos = await apiRequest(`/transportes/${idTransporte}/pedidos-rota`);
        popularTabelaPedidosRota(pedidos);
    } catch (err) {
        console.error('Erro ao carregar pedidos para rota:', err);
        const tbody = document.getElementById('tabela-pedidos-rota');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar pedidos</td></tr>';
        }
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
            <td>${pedido.clientes?.nome || '-'}</td>
            <td>${pedido.produtos?.nome || '-'}</td>
            <td><span class="badge bg-info">${pedido.status || '-'}</span></td>
            <td>${pedido.enderecos ? `${pedido.enderecos.cidade} - ${pedido.enderecos.estado}` : '-'}</td>
        </tr>
    `).join('');

    const selectAll = document.getElementById('selecionar-todos-pedidos-rota');
    if (selectAll) {
        selectAll.onchange = function() {
            tbody.querySelectorAll('.pedido-rota-checkbox').forEach(cb => {
                cb.checked = this.checked;
            });
        };
    }
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
            <td>${pedido.clientes?.nome || '-'}</td>
            <td>${pedido.produtos?.nome || '-'}</td>
            <td>${pedido.status || '-'}</td>
            <td>${pedido.enderecos ? `${pedido.enderecos.cidade} - ${pedido.enderecos.estado}` : '-'}</td>
        </tr>
    `).join('');

    const selectAll = document.getElementById('selecionar-todos');
    if (selectAll) {
        selectAll.onchange = function() {
            tbody.querySelectorAll('.pedido-checkbox').forEach(cb => {
                cb.checked = this.checked;
            });
        };
    }

    const filtro = document.getElementById('filtro-pedidos');
    if (filtro) {
        filtro.oninput = function() {
            const filtroText = this.value.toLowerCase();
            tbody.querySelectorAll('tr').forEach(linha => {
                const texto = linha.textContent.toLowerCase();
                linha.style.display = texto.includes(filtroText) ? '' : 'none';
            });
        };
    }
}

// ---------------------- AÇÕES PRINCIPAIS ----------------------

async function criarNovoTransporte() {
    const dados = {
        tipo_transporte: document.getElementById('transporte-tipo').value,
        direcao: document.getElementById('transporte-direcao').value,
        quantidade_total: document.getElementById('transporte-quantidade').value,
        peso_total_kg: document.getElementById('transporte-peso').value,
        volumetria_total: document.getElementById('transporte-volumetria').value,
        observacoes: document.getElementById('transporte-observacoes').value
    };

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

    const validacaoQuantidade = validarNumeroPositivo(dados.quantidade_total, 'Quantidade');
    const validacaoPeso = validarNumeroPositivo(dados.peso_total_kg, 'Peso');
    const validacaoVolumetria = validarNumeroPositivo(dados.volumetria_total, 'Volumetria');

    if (!validacaoQuantidade.valido || !validacaoPeso.valido || !validacaoVolumetria.valido) {
        mostrarFeedback(validacaoQuantidade.erro || validacaoPeso.erro || validacaoVolumetria.erro, 'error');
        return;
    }

    dados.quantidade_total = validacaoQuantidade.valor;
    dados.peso_total_kg = validacaoPeso.valor;
    dados.volumetria_total = validacaoVolumetria.valor;

    try {
        mostrarCarregamento(true);
        await apiRequest('/transportes', 'POST', dados);
        
        mostrarFeedback('Transporte criado com sucesso!', 'success');
        $('#modal-novo-transporte').modal('hide');
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
        peso_total_kg: document.getElementById('editar-peso').value,
        volumetria_total: document.getElementById('editar-volumetria').value,
        observacoes: document.getElementById('editar-observacoes').value
    };

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

    const validacaoQuantidade = validarNumeroPositivo(dados.quantidade_total, 'Quantidade');
    const validacaoPeso = validarNumeroPositivo(dados.peso_total_kg, 'Peso');
    const validacaoVolumetria = validarNumeroPositivo(dados.volumetria_total, 'Volumetria');

    if (!validacaoQuantidade.valido || !validacaoPeso.valido || !validacaoVolumetria.valido) {
        mostrarFeedback(validacaoQuantidade.erro || validacaoPeso.erro || validacaoVolumetria.erro, 'error');
        return;
    }

    dados.quantidade_total = validacaoQuantidade.valor;
    dados.peso_total_kg = validacaoPeso.valor;
    dados.volumetria_total = validacaoVolumetria.valor;

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${transporteId}`, 'PUT', dados);
        
        mostrarFeedback('Transporte atualizado com sucesso!', 'success');
        $('#modal-editar-transporte').modal('hide');
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao atualizar transporte: ${err.message}`, 'error');
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
        $('#modal-atribuir-rota').modal('hide');
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao atribuir rota: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function criarRota() {
    const cluster = document.getElementById('rota-cluster').value;

    if (!cluster) {
        mostrarFeedback('Informe o cluster da rota', 'error');
        return;
    }

    const pedidosSelecionados = [];
    document.querySelectorAll('.pedido-rota-checkbox:checked').forEach(cb => {
        pedidosSelecionados.push(parseInt(cb.value));
    });

    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${currentTransporteId}/criar-rota`, 'POST', {
            cluster: cluster,
            pedidos: pedidosSelecionados
        });
        
        mostrarFeedback('Rota criada com sucesso!', 'success');
        $('#modal-criar-rota').modal('hide');
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
        $('#modal-associar-conferencia').modal('hide');
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
        $('#modal-associar-pedidos').modal('hide');
        await carregarTransportes();
    } catch (err) {
        mostrarFeedback(`Erro ao associar pedidos: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------------------- AÇÕES DE STATUS DO TRANSPORTE ----------------------

async function iniciarTransporte(idTransporte) {
    if (!confirm('Deseja realmente iniciar este transporte?')) return;

    try {
        mostrarCarregamento(true);
        
        // Chamar a API para iniciar o transporte
        await apiRequest(`/transportes/${idTransporte}/iniciar`, 'POST');
        
        mostrarFeedback('Transporte iniciado com sucesso!', 'success');
        
        // Fechar modal de detalhes e recarregar dados
        $('#modal-detalhes').modal('hide');
        await carregarTransportes();
        
    } catch (err) {
        console.error('Erro ao iniciar transporte:', err);
        mostrarFeedback(`Erro ao iniciar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function finalizarTransporte(idTransporte) {
    if (!confirm('Deseja realmente finalizar este transporte?')) return;

    try {
        mostrarCarregamento(true);
        
        // Chamar a API para finalizar o transporte
        await apiRequest(`/transportes/${idTransporte}/atualizar-status`, 'POST', {
            status: 'RECEBIDO'
        });
        
        mostrarFeedback('Transporte finalizado com sucesso!', 'success');
        
        // Fechar modal de detalhes e recarregar dados
        $('#modal-detalhes').modal('hide');
        await carregarTransportes();
        
    } catch (err) {
        console.error('Erro ao finalizar transporte:', err);
        mostrarFeedback(`Erro ao finalizar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function cancelarTransporte(idTransporte) {
    if (!confirm('Deseja realmente cancelar este transporte?')) return;

    try {
        mostrarCarregamento(true);
        
        // Chamar a API para cancelar o transporte
        await apiRequest(`/transportes/${idTransporte}/atualizar-status`, 'POST', {
            status: 'CANCELADO'
        });
        
        mostrarFeedback('Transporte cancelado com sucesso!', 'success');
        await carregarTransportes();
        
    } catch (err) {
        console.error('Erro ao cancelar transporte:', err);
        mostrarFeedback(`Erro ao cancelar transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function excluirTransporte(id) {
    if (!confirm('Tem certeza que deseja excluir este transporte? Esta ação não pode ser desfeita.')) return;
    
    try {
        mostrarCarregamento(true);
        await apiRequest(`/transportes/${id}`, 'DELETE');
        mostrarFeedback('Transporte excluído com sucesso!', 'success');
        await carregarTransportes();
    } catch (err) {
        console.error('Erro ao excluir transporte:', err);
        mostrarFeedback(`Erro ao excluir transporte: ${err.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------------------- INICIALIZAÇÃO ----------------------

document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    carregarTransportes();
    carregarDadosAuxiliares();
    
    const btnCriarTransporte = document.getElementById('btn-criar-transporte');
    if (btnCriarTransporte) btnCriarTransporte.addEventListener('click', criarNovoTransporte);
    
    const btnSalvarEdicao = document.getElementById('btn-salvar-edicao');
    if (btnSalvarEdicao) btnSalvarEdicao.addEventListener('click', salvarEdicaoTransporte);
    
    const btnConfirmarRota = document.getElementById('btn-confirmar-rota');
    if (btnConfirmarRota) btnConfirmarRota.addEventListener('click', atribuirRota);
    
    const btnConfirmarCriarRota = document.getElementById('btn-confirmar-criar-rota');
    if (btnConfirmarCriarRota) btnConfirmarCriarRota.addEventListener('click', criarRota);
    
    const btnConfirmarConferencia = document.getElementById('btn-confirmar-conferencia');
    if (btnConfirmarConferencia) btnConfirmarConferencia.addEventListener('click', associarConferencia);
    
    const btnConfirmarPedidos = document.getElementById('btn-confirmar-pedidos');
    if (btnConfirmarPedidos) btnConfirmarPedidos.addEventListener('click', associarPedidos);
    
    const btnLimparFiltro = document.getElementById('btn-limpar-filtro-pedidos');
    if (btnLimparFiltro) {
        btnLimparFiltro.addEventListener('click', function() {
            const filtro = document.getElementById('filtro-pedidos');
            if (filtro) filtro.value = '';
            popularTabelaPedidosDisponiveis();
        });
    }

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

    const tabelaTransportes = document.getElementById('tabela-transportes');
    if (tabelaTransportes) {
        tabelaTransportes.addEventListener('click', function(e) {
            const btn = e.target.closest('button');
            if (!btn) return;

            const transporteId = btn.dataset.id;
            const acao = btn.dataset.action;

            if (!transporteId) return;

            switch(acao) {
                case 'view':
                    abrirDetalhesTransporte(transporteId);
                    break;
                case 'edit':
                    const transporte = transportesData.find(t => t.id == transporteId);
                    if (transporte) abrirEdicaoTransporte(transporte);
                    break;
                case 'delete':
                    excluirTransporte(transporteId);
                    break;
                case 'cancel':
                    cancelarTransporte(transporteId);
                    break;
                case 'criar-rota':
                    abrirModalCriarRota(transporteId);
                    break;
            }
        });
    }

    const filtroNumero = document.getElementById('filtro-numero');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroDirecao = document.getElementById('filtro-direcao');
    const filtroStatus = document.getElementById('filtro-status');

    if (filtroNumero) filtroNumero.addEventListener('input', atualizarFiltros);
    if (filtroTipo) filtroTipo.addEventListener('change', atualizarFiltros);
    if (filtroDirecao) filtroDirecao.addEventListener('change', atualizarFiltros);
    if (filtroStatus) filtroStatus.addEventListener('change', atualizarFiltros);

    console.log('Sistema de transportes inicializado - Bootstrap 4.6 compatível');
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

window.filtrarPorStatus = function(status) {
    const filtroStatus = document.getElementById('filtro-status');
    if (filtroStatus) {
        filtroStatus.value = status;
        atualizarFiltros();
    }
};

window.abrirModalNovoTransporte = abrirModalNovoTransporte;
window.abrirModalEditarTransporte = abrirEdicaoTransporte;
window.abrirModalAtribuirRota = abrirModalAtribuirRota;
window.abrirModalCriarRota = abrirModalCriarRota;
window.abrirModalAssociarConferencia = abrirModalAssociarConferencia;
window.abrirModalAssociarPedidos = abrirModalAssociarPedidos;