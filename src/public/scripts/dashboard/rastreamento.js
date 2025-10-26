// Mapeamento de status
const STATUS_PEDIDO = {
    'NO_HUB': { class: 'badge-no-hub', text: 'No Hub' },
    'EM_ROTA': { class: 'badge-em-rota', text: 'Em Rota' },
    'ENTREGUE': { class: 'badge-entregue', text: 'Entregue' },
    'EXCECAO': { class: 'badge-excecao', text: 'Exceção' }
};

const STATUS_ROTA = {
    'CRIADA': { class: 'badge-criada', text: 'Criada' },
    'EM_ANDAMENTO': { class: 'badge-em-andamento', text: 'Em Andamento' },
    'FINALIZADA': { class: 'badge-finalizada', text: 'Finalizada' }
};

const STATUS_PARADA = {
    'PENDENTE': { class: 'parada-pendente', text: 'Pendente' },
    'EM_ENTREGA': { class: 'parada-em-entrega', text: 'Em Entrega' },
    'ENTREGUE': { class: 'parada-entregue', text: 'Entregue' },
    'FALHA': { class: 'parada-falha', text: 'Falha' }
};

// Variáveis globais
let mapa;
let rotaSelecionada = null;

// Inicialização
$(document).ready(function() {
    carregarPedidos();
    carregarRotas();
    carregarParadas();
    
    // Inicializa mapa (vazio por enquanto)
    if ($('#mapaRota').length) {
        mapa = L.map('mapaRota').setView([-15.788, -47.879], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapa);
    }
});

// ========== FUNÇÕES PARA PEDIDOS ==========
async function carregarPedidos(filtros = {}) {
    try {
        const query = new URLSearchParams(filtros).toString();
        const response = await fetch(`/rastreamento/?${query}`);
        const pedidos = await response.json();
        renderizarPedidos(pedidos);
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        $('#tabelaPedidos').html('<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados</td></tr>');
    }
}

function renderizarPedidos(pedidos) {
    const tbody = $('#tabelaPedidos');
    tbody.empty();
    
    if (pedidos.length === 0) {
        tbody.html('<tr><td colspan="6" class="text-center">Nenhum pedido encontrado</td></tr>');
        return;
    }
    
    pedidos.forEach(pedido => {
        const status = STATUS_PEDIDO[pedido.status_atual] || { class: '', text: pedido.status_atual };
        const dataFormatada = pedido.data_status ? new Date(pedido.data_status).toLocaleString() : '-';
        
        const tr = $(`
            <tr>
                <td>${pedido.pedido_id}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>${dataFormatada}</td>
                <td>${pedido.localizacao || '-'}</td>
                <td>${pedido.rota ? `Rota #${pedido.rota.id}` : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="verDetalhesPedido(${pedido.pedido_id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `);
        
        tbody.append(tr);
    });
}

function filtrarPedidos() {
    const filtros = {
        pedido_id: $('#filtroPedido').val(),
        status: $('#filtroStatusPedido').val()
    };
    carregarPedidos(filtros);
}

// ========== FUNÇÕES PARA ROTAS ==========
async function carregarRotas(filtros = {}) {
    try {
        const query = new URLSearchParams(filtros).toString();
        const response = await fetch(`/rotas/?${query}`);
        const rotas = await response.json();
        renderizarRotas(rotas);
    } catch (error) {
        console.error('Erro ao carregar rotas:', error);
        $('#tabelaRotas').html('<tr><td colspan="7" class="text-center text-danger">Erro ao carregar dados</td></tr>');
    }
}

function renderizarRotas(rotas) {
    const tbody = $('#tabelaRotas');
    tbody.empty();
    
    if (rotas.length === 0) {
        tbody.html('<tr><td colspan="7" class="text-center">Nenhuma rota encontrada</td></tr>');
        return;
    }
    
    rotas.forEach(rota => {
        const status = STATUS_ROTA[rota.status_rota] || { class: '', text: rota.status_rota };
        
        const tr = $(`
            <tr onclick="verDetalhesRota(${rota.id})" style="cursor:pointer;">
                <td>${rota.id}</td>
                <td>${rota.motorista?.nome || 'Não atribuído'}</td>
                <td>${rota.cluster || '-'}</td>
                <td>${rota.numero_paradas || 0}</td>
                <td>${rota.distancia_total_km ? `${rota.distancia_total_km} km` : '-'}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); verDetalhesRota(${rota.id})">
                        <i class="fas fa-map-marked-alt"></i>
                    </button>
                </td>
            </tr>
        `);
        
        tbody.append(tr);
    });
}

async function verDetalhesRota(rotaId) {
    try {
        const [rota, paradas] = await Promise.all([
            fetch(`/rota/${rotaId}`).then(r => r.json()),
            fetch(`/rota/${rotaId}/paradas`).then(r => r.json())
        ]);
        
        rotaSelecionada = rota;
        $('#rotaId').text(`#${rota.id}`);
        
        // Atualiza informações da rota
        const status = STATUS_ROTA[rota.status_rota] || { class: '', text: rota.status_rota };
        $('#infoRota').html(`
            <p><strong>Motorista:</strong> ${rota.motorista?.nome || 'Não atribuído'}</p>
            <p><strong>Status:</strong> <span class="badge ${status.class}">${status.text}</span></p>
            <p><strong>Cluster:</strong> ${rota.cluster || '-'}</p>
            <p><strong>Paradas:</strong> ${rota.numero_paradas || 0}</p>
            <p><strong>Distância:</strong> ${rota.distancia_total_km || '0'} km</p>
        `);
        
        // Renderiza paradas
        const paradasHtml = paradas.map(parada => {
            const status = STATUS_PARADA[parada.status_parada] || { class: '', text: parada.status_parada };
            return `
                <div class="card mb-2 ${status.class} parada-card">
                    <div class="card-body">
                        <h5 class="card-title">Parada #${parada.ordem_entrega}</h5>
                        <p class="card-text">
                            <strong>Pedido:</strong> ${parada.id_pedido}<br>
                            <strong>Status:</strong> <span class="badge ${status.class.replace('parada-', 'badge-')}">${status.text}</span><br>
                            <strong>Gaiola:</strong> ${parada.gaiola_codigo || '-'}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
        
        $('#paradasRota').html(paradasHtml || '<p class="text-muted">Nenhuma parada registrada</p>');
        
        // Configura botão de finalizar
        $('#btnFinalizarRota').toggle(rota.status_rota === 'EM_ANDAMENTO');
        $('#btnFinalizarRota').off('click').on('click', () => finalizarRota(rota.id));
        
        // TODO: Adicionar lógica para renderizar mapa com as paradas
        // renderizarMapaRota(rota, paradas);
        
        $('#modalRota').modal('show');
    } catch (error) {
        console.error('Erro ao carregar detalhes da rota:', error);
        alert('Erro ao carregar detalhes da rota');
    }
}

async function finalizarRota(rotaId) {
    if (!confirm('Deseja finalizar esta rota? Todos os pedidos serão marcados como entregues.')) return;
    
    try {
        const response = await fetch(`/rota/${rotaId}/finalizar`, { method: 'POST' });
        if (!response.ok) throw new Error('Erro ao finalizar rota');
        
        alert('Rota finalizada com sucesso!');
        $('#modalRota').modal('hide');
        carregarRotas();
        carregarPedidos();
    } catch (error) {
        console.error('Erro ao finalizar rota:', error);
        alert('Erro ao finalizar rota');
    }
}

function filtrarRotas() {
    const filtros = {
        status: $('#filtroStatusRota').val(),
        data: $('#filtroDataRota').val(),
        cluster: $('#filtroCluster').val()
    };
    carregarRotas(filtros);
}

// ========== FUNÇÕES PARA PARADAS ==========
async function carregarParadas(filtros = {}) {
    try {
        const query = new URLSearchParams(filtros).toString();
        const response = await fetch(`/paradas/?${query}`);
        const paradas = await response.json();
        renderizarParadas(paradas);
    } catch (error) {
        console.error('Erro ao carregar paradas:', error);
        $('#listaParadas').html('<div class="alert alert-danger">Erro ao carregar dados</div>');
    }
}

function renderizarParadas(paradas) {
    const container = $('#listaParadas');
    container.empty();
    
    if (paradas.length === 0) {
        container.html('<p class="text-muted">Nenhuma parada encontrada</p>');
        return;
    }
    
    paradas.forEach(parada => {
        const status = STATUS_PARADA[parada.status_parada] || { class: '', text: parada.status_parada };
        
        const card = $(`
            <div class="card mb-3 ${status.class} parada-card">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h5 class="card-title">Parada #${parada.ordem_entrega}</h5>
                            <p class="card-text">
                                <strong>Rota:</strong> ${parada.id_rota}<br>
                                <strong>Pedido:</strong> ${parada.id_pedido}<br>
                                <strong>Status:</strong> <span class="badge ${status.class.replace('parada-', 'badge-')}">${status.text}</span>
                            </p>
                        </div>
                        <div class="col-md-4 text-right">
                            <button class="btn btn-sm btn-info" onclick="verDetalhesParada(${parada.id})">
                                <i class="fas fa-eye"></i> Detalhes
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="atualizarStatusParada(${parada.id}, 'EM_ENTREGA')" ${parada.status_parada !== 'PENDENTE' ? 'disabled' : ''}>
                                <i class="fas fa-truck"></i> Iniciar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        container.append(card);
    });
}

async function verDetalhesParada(paradaId) {
    try {
        const parada = await fetch(`/parada/${paradaId}`).then(r => r.json());
        const status = STATUS_PARADA[parada.status_parada] || { class: '', text: parada.status_parada };
        
        // TODO: Implementar modal de detalhes da parada
        alert(`Detalhes da Parada:\n\nRota: ${parada.id_rota}\nPedido: ${parada.id_pedido}\nStatus: ${status.text}\nGaiola: ${parada.gaiola_codigo || '-'}`);
    } catch (error) {
        console.error('Erro ao carregar detalhes da parada:', error);
        alert('Erro ao carregar detalhes da parada');
    }
}

async function atualizarStatusParada(paradaId, novoStatus) {
    try {
        const response = await fetch(`/parada/${paradaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_parada: novoStatus })
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar parada');
        
        alert('Status da parada atualizado!');
        carregarParadas();
    } catch (error) {
        console.error('Erro ao atualizar parada:', error);
        alert('Erro ao atualizar parada');
    }
}

function filtrarParadas() {
    const filtros = {
        status: $('#filtroStatusParada').val(),
        id_rota: $('#filtroRotaParada').val(),
        id_pedido: $('#filtroPedidoParada').val()
    };
    carregarParadas(filtros);
}