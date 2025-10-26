let pedidosDisponiveis = [];
let pedidosSelecionados = [];
let motoristas = [];
let rotas = [];
let rotaAtual = null;
let paradasDaRota = [];

const API_BASE_URL = 'http://localhost:8080';
// ---------- Autenticação ----------
function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}
// ---------- Fetch genérico com token ----------
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
            console.warn('Token inválido ou expirado');
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

// ---------- Helper genérico ----------
async function apiRequest(path, method = 'GET', data = null, query = null) {
    try {
        const url = new URL(API_BASE_URL + path);
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

    // Carregar dados do usuário
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

    // Inicializar dashboard
    carregarConferencias();
    carregarRecebimentos();

    // Configurar eventos
    configurarEventos();
});

// Função para mostrar feedback na interface
function showFeedback(message, type) {
    const feedback = document.getElementById('feedback-message');
    feedback.className = `alert alert-${type} alert-dismissible fade show`;
    feedback.querySelector('#feedback-text').textContent = message;
    feedback.style.display = 'block';
    
    setTimeout(() => {
        feedback.style.display = 'none';
    }, 5000);
}

// Função para mostrar/ocultar o loading
function showLoading() {
    document.getElementById('loading-spinner').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading-spinner').style.display = 'none';
}

// Função para carregar as rotas do servidor
async function carregarRotas() {
    showLoading();
    try {
        rotas = await apiRequest('/rotas');
        renderizarRotas(rotas);
        atualizarResumo(rotas);
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao carregar rotas: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}
// Função para renderizar as rotas na tabela
function renderizarRotas(rotas) {
    const tbody = document.getElementById('tabela-rotas');
    tbody.innerHTML = '';

    if (rotas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma rota encontrada</td></tr>';
        return;
    }

    rotas.forEach(rota => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rota.id}</td>
            <td>${rota.cluster || 'N/A'}</td>
            <td>${rota.motorista ? rota.motorista.nome : 'N/A'}</td>
            <td>${rota.numero_paradas || 0}</td>
            <td>${rota.distancia_total_km || '0.00'}</td>
            <td><span class="badge badge-${getStatusBadgeClass(rota.status_rota)}">${rota.status_rota}</span></td>
            <td>${new Date(rota.createdAt).toLocaleDateString()}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="verDetalhesRota(${rota.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="excluirRota(${rota.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Função para retornar a classe do badge baseado no status
function getStatusBadgeClass(status) {
    switch (status) {
        case 'CRIADA': return 'criada';
        case 'EM_ANDAMENTO': return 'em-andamento';
        case 'FINALIZADA': return 'finalizada';
        default: return 'secondary';
    }
}

// Função para atualizar o resumo de rotas
function atualizarResumo(rotas) {
    const hoje = new Date().toISOString().split('T')[0];
    
    const totalCriadas = rotas.filter(r => r.status_rota === 'CRIADA').length;
    const totalAndamento = rotas.filter(r => r.status_rota === 'EM_ANDAMENTO').length;
    const totalFinalizadas = rotas.filter(r => r.status_rota === 'FINALIZADA').length;
    
    // Calcular paradas do dia atual
    const totalParadasHoje = rotas.reduce((total, rota) => {
        if (new Date(rota.createdAt).toISOString().split('T')[0] === hoje) {
            return total + (rota.numero_paradas || 0);
        }
        return total;
    }, 0);

    document.getElementById('total-criadas').textContent = totalCriadas;
    document.getElementById('total-andamento').textContent = totalAndamento;
    document.getElementById('total-finalizadas').textContent = totalFinalizadas;
    document.getElementById('total-paradas').textContent = totalParadasHoje;
}

// Função para carregar motoristas
async function carregarMotoristas() {
    try {
        const response = await apiRequest('/motoristas');
        if (!response.ok) throw new Error('Erro ao carregar motoristas');
        motoristas = await response.json();
        
        // Preencher o select de motoristas no modal de nova rota
        const selectMotorista = document.getElementById('nova-rota-motorista');
        selectMotorista.innerHTML = '<option value="">Selecione um motorista</option>';
        motoristas.forEach(motorista => {
            const option = document.createElement('option');
            option.value = motorista.id;
            option.textContent = `${motorista.nome} - ${motorista.veiculo || 'Sem veículo'}`;
            selectMotorista.appendChild(option);
        });

        // Preencher também o filtro de motoristas
        const filtroMotorista = document.getElementById('filtro-motorista');
        filtroMotorista.innerHTML = '<option value="">Todos</option>';
        motoristas.forEach(motorista => {
            const option = document.createElement('option');
            option.value = motorista.id;
            option.textContent = motorista.nome;
            filtroMotorista.appendChild(option);
        });
    } catch (error) {
        console.error('Erro:', error);
        showFeedback('Erro ao carregar motoristas.', 'danger');
    }
}

// Função para abrir o modal de nova rota
async function abrirModalNovaRota() {
    // Limpar seleções anteriores
    pedidosSelecionados = [];
    document.getElementById('contador-pedidos').textContent = '0 pedido(s) selecionado(s)';
    document.getElementById('btn-criar-rota').disabled = true;
    document.getElementById('selecionar-todos').checked = false;
    document.getElementById('buscar-pedidos').value = '';
    document.getElementById('nova-rota-cluster').value = '';
    document.getElementById('nova-rota-motorista').value = '';
    
    // Carregar motoristas
    await carregarMotoristas();
    
    // Carregar pedidos disponíveis
    await carregarPedidosDisponiveis();
    
    // Abrir o modal
    $('#modal-nova-rota').modal('show');
}

// Função para carregar pedidos disponíveis
async function carregarPedidosDisponiveis() {
    showLoading();
    try {
        pedidosDisponiveis = await apiRequest('/rotas/pedidos-disponiveis');
        renderizarTabelaPedidos(pedidosDisponiveis);
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao carregar pedidos disponíveis.', 'danger');
    } finally {
        hideLoading();
    }
}

// Função para renderizar a tabela de pedidos
function renderizarTabelaPedidos(pedidos) {
    const tbody = document.getElementById('tabela-pedidos-disponiveis');
    tbody.innerHTML = '';
    
    if (pedidos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-3">
                    Nenhum pedido disponível para roteirização
                </td>
            </tr>
        `;
        return;
    }
    
    pedidos.forEach(pedido => {
        const tr = document.createElement('tr');
        const isSelected = pedidosSelecionados.includes(pedido.id);
        
        tr.innerHTML = `
            <td>
                <input type="checkbox" value="${pedido.id}" 
                       onchange="selecionarPedido(this)" 
                       ${isSelected ? 'checked' : ''}>
            </td>
            <td>${pedido.codigo_pedido || 'N/A'}</td>
            <td>${pedido.cliente ? pedido.cliente.nome : 'N/A'}</td>
            <td>${pedido.produto ? pedido.produto.nome : 'N/A'}</td>
            <td>${pedido.endereco ? 
                  `${pedido.endereco.logradouro}, ${pedido.endereco.bairro}` : 
                  'Endereço não informado'}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Função para selecionar/deselecionar pedido
function selecionarPedido(checkbox) {
    const pedidoId = parseInt(checkbox.value);
    
    if (checkbox.checked) {
        if (!pedidosSelecionados.includes(pedidoId)) {
            pedidosSelecionados.push(pedidoId);
        }
    } else {
        pedidosSelecionados = pedidosSelecionados.filter(id => id !== pedidoId);
        document.getElementById('selecionar-todos').checked = false;
    }
    
    // Atualizar contador
    document.getElementById('contador-pedidos').textContent = 
        `${pedidosSelecionados.length} pedido(s) selecionado(s)`;
    
    // Habilitar/desabilitar botão de criar
    const cluster = document.getElementById('nova-rota-cluster').value;
    const motorista = document.getElementById('nova-rota-motorista').value;
    validarFormularioRota(cluster, motorista);
}

// Função para selecionar todos os pedidos
function selecionarTodosPedidos() {
    const selectAll = document.getElementById('selecionar-todos').checked;
    const checkboxes = document.querySelectorAll('#tabela-pedidos-disponiveis input[type="checkbox"]');
    
    pedidosSelecionados = [];
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
        if (selectAll) {
            pedidosSelecionados.push(parseInt(checkbox.value));
        }
    });
    
    // Atualizar contador
    document.getElementById('contador-pedidos').textContent = 
        `${pedidosSelecionados.length} pedido(s) selecionado(s)`;
    
    // Habilitar/desabilitar botão de criar
    const cluster = document.getElementById('nova-rota-cluster').value;
    const motorista = document.getElementById('nova-rota-motorista').value;
    validarFormularioRota(cluster, motorista);
}

// Função para filtrar pedidos
function filtrarPedidos() {
    const termo = document.getElementById('buscar-pedidos').value.toLowerCase();
    
    if (!termo) {
        renderizarTabelaPedidos(pedidosDisponiveis);
        return;
    }
    
    const pedidosFiltrados = pedidosDisponiveis.filter(pedido => {
        return (
            (pedido.codigo_pedido && pedido.codigo_pedido.toLowerCase().includes(termo)) ||
            (pedido.cliente && pedido.cliente.nome.toLowerCase().includes(termo)) ||
            (pedido.produto && pedido.produto.nome.toLowerCase().includes(termo)) ||
            (pedido.endereco && (
                (pedido.endereco.logradouro && pedido.endereco.logradouro.toLowerCase().includes(termo)) ||
                (pedido.endereco.bairro && pedido.endereco.bairro.toLowerCase().includes(termo))
            ))
        );
    });
    
    renderizarTabelaPedidos(pedidosFiltrados);
}

// Função para validar o formulário
function validarFormularioRota(cluster, motorista) {
    const btnCriar = document.getElementById('btn-criar-rota');
    btnCriar.disabled = !(cluster && motorista && pedidosSelecionados.length > 0);
}

// Função para criar nova rota
async function criarNovaRota() {
    const cluster = document.getElementById('nova-rota-cluster').value;
    const motoristaId = document.getElementById('nova-rota-motorista').value;
    if (!cluster || !motoristaId || pedidosSelecionados.length === 0) {
        showFeedback('Preencha todos os campos obrigatórios e selecione pelo menos um pedido.', 'warning');
        return;
    }
    showLoading();
    try {
        await apiRequest('/rotas', 'POST', {
            cluster,
            id_motorista: parseInt(motoristaId),
            pedidos: pedidosSelecionados
        });
        showFeedback('Rota criada com sucesso!', 'success');
        $('#modal-nova-rota').modal('hide');
        await carregarRotas();
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao criar rota: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Função para ver detalhes de uma rota
async function verDetalhesRota(id) {
    showLoading();
    try {
        rotaAtual = await apiRequest(`/rotas/${id}`);
        document.getElementById('detalhe-id').value = rotaAtual.id;
        document.getElementById('detalhe-cluster').value = rotaAtual.cluster || 'N/A';
        document.getElementById('detalhe-motorista').value = rotaAtual.motorista ? rotaAtual.motorista.nome : 'N/A';
        document.getElementById('detalhe-total-paradas').value = rotaAtual.numero_paradas || 0;
        document.getElementById('detalhe-distancia').value = rotaAtual.distancia_total_km || '0.00';
        document.getElementById('detalhe-status').value = rotaAtual.status_rota || 'N/A';

        document.getElementById('btn-iniciar-rota').style.display = rotaAtual.status_rota === 'CRIADA' ? 'inline-block' : 'none';
        document.getElementById('btn-finalizar-rota').style.display = rotaAtual.status_rota === 'EM_ANDAMENTO' ? 'inline-block' : 'none';

        await carregarParadasRota(id);
        $('#modal-detalhes').modal('show');
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao carregar detalhes da rota: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Função para carregar paradas de uma rota
async function carregarParadasRota(id) {
    try {
        paradasDaRota = await apiRequest(`/rotas/${id}/paradas`);
        const tbody = document.getElementById('detalhe-paradas');
        tbody.innerHTML = '';
        if (!paradasDaRota || paradasDaRota.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma parada encontrada</td></tr>';
            return;
        }
        paradasDaRota.forEach(parada => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${parada.ordem_entrega || 'N/A'}</td>
                <td>${parada.pedido ? parada.pedido.codigo_pedido : 'N/A'}</td>
                <td>${parada.codigo_gaiola || 'N/A'}</td>
                <td><span class="badge badge-${getStatusParadaClass(parada.status_parada)}">${parada.status_parada}</span></td>
                <td><button class="btn btn-sm btn-info" onclick="editarParada(${parada.id})"><i class="fas fa-edit"></i></button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao carregar paradas da rota: ' + err.message, 'danger');
    }
}

// Função para retornar a classe do badge baseado no status da parada
function getStatusParadaClass(status) {
    switch (status) {
        case 'PENDENTE': return 'pendente';
        case 'EM_ANDAMENTO': return 'em-andamento';
        case 'ENTREGUE': return 'entregue';
        case 'FALHA': return 'falha';
        default: return 'secondary';
    }
}

// Função para excluir uma rota
async function excluirRota(id) {
    if (!confirm('Tem certeza que deseja excluir esta rota?')) return;
    showLoading();
    try {
        await apiRequest(`/rotas/${id}`, 'DELETE');
        showFeedback('Rota excluída com sucesso!', 'success');
        await carregarRotas();
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao excluir rota: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Função para iniciar uma rota
async function iniciarRota() {
    if (!rotaAtual) return;
    showLoading();
    try {
        await apiRequest(`/rotas/${rotaAtual.id}/iniciar`, 'POST');
        showFeedback('Rota iniciada com sucesso!', 'success');
        $('#modal-detalhes').modal('hide');
        await carregarRotas();
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao iniciar rota: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Função para finalizar uma rota
async function finalizarRota() {
    if (!rotaAtual) return;
    showLoading();
    try {
        await apiRequest(`/rotas/${rotaAtual.id}/finalizar`, 'POST');
        showFeedback('Rota finalizada com sucesso!', 'success');
        $('#modal-detalhes').modal('hide');
        await carregarRotas();
    } catch (err) {
        console.error('Erro:', err);
        showFeedback('Erro ao finalizar rota: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

// Função para adicionar uma parada à rota
function adicionarParada() {
    // Implementar lógica para adicionar parada
    showFeedback('Funcionalidade de adicionar parada em desenvolvimento', 'info');
}

// Função para editar uma parada
function editarParada(id) {
    // Implementar lógica para editar parada
    showFeedback('Funcionalidade de editar parada em desenvolvimento', 'info');
}

// Função para filtrar por status (usada nos cards de resumo)
function filtrarPorStatus(status) {
    const filtroStatus = document.getElementById('filtro-status');
    filtroStatus.value = status === 'TODAS' ? '' : status;
    
    // Disparar evento change para aplicar o filtro
    const event = new Event('change');
    filtroStatus.dispatchEvent(event);
}

// Função para aplicar filtros
function aplicarFiltros() {
    const id = document.getElementById('filtro-id').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const motoristaId = document.getElementById('filtro-motorista').value;
    const data = document.getElementById('filtro-data').value;
    
    let rotasFiltradas = rotas;
    
    if (id) {
        rotasFiltradas = rotasFiltradas.filter(rota => 
            rota.id.toString().toLowerCase().includes(id)
        );
    }
    
    if (status) {
        rotasFiltradas = rotasFiltradas.filter(rota => rota.status_rota === status);
    }
    
    if (motoristaId) {
        rotasFiltradas = rotasFiltradas.filter(rota => 
            rota.motorista && rota.motorista.id.toString() === motoristaId
        );
    }
    
    if (data) {
        rotasFiltradas = rotasFiltradas.filter(rota => {
            const rotaData = new Date(rota.createdAt).toISOString().split('T')[0];
            return rotaData === data;
        });
    }
    
    renderizarRotas(rotasFiltradas);
}

// Inicialização quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    carregarRotas();
    carregarMotoristas();
    
    // Adicionar event listeners para os campos obrigatórios no modal de nova rota
    document.getElementById('nova-rota-cluster').addEventListener('change', function() {
        const motorista = document.getElementById('nova-rota-motorista').value;
        validarFormularioRota(this.value, motorista);
    });
    
    document.getElementById('nova-rota-motorista').addEventListener('change', function() {
        const cluster = document.getElementById('nova-rota-cluster').value;
        validarFormularioRota(cluster, this.value);
    });
    
    // Adicionar event listeners para os botões de ação
    document.getElementById('btn-iniciar-rota').addEventListener('click', iniciarRota);
    document.getElementById('btn-finalizar-rota').addEventListener('click', finalizarRota);
    
    // Adicionar event listeners para os filtros
    document.getElementById('filtro-id').addEventListener('input', aplicarFiltros);
    document.getElementById('filtro-status').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-motorista').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-data').addEventListener('change', aplicarFiltros);
});