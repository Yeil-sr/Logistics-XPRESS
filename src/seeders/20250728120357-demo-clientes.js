'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.bulkInsert('Clientes', [
      // Clientes originais mantidos
      {
        nome: 'John Doe',
        email: 'johndoe@email.com',
        telefone: '27999999999',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Ana Souza',
        email: 'ana@ana.com',
        telefone: '27999885501',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Marcos Cintra',
        email: 'marcos@marcos.com',
        telefone: '27999785511',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Felipe Cardoso',
        email: 'felipe@felipe.com',
        telefone: '27999784511',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sandra Gomes',
        email: 'sandra@sandra.com',
        telefone: '27998785411',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Paula Morais',
        email: 'paula@paula.com',
        telefone: '27999785511',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sergio Lopes',
        email: 'sergio@sergio.com',
        telefone: '27997885531',
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // Novos clientes - Total 150
      {
        nome: 'Carlos Eduardo Santos',
        email: 'carlos.santos@email.com',
        telefone: '27998887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Mariana Oliveira',
        email: 'mariana.oliveira@email.com',
        telefone: '27997776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Ricardo Almeida',
        email: 'ricardo.almeida@email.com',
        telefone: '27996665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Fernanda Costa',
        email: 'fernanda.costa@email.com',
        telefone: '27995554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Bruno Rodrigues',
        email: 'bruno.rodrigues@email.com',
        telefone: '27994443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Juliana Pereira',
        email: 'juliana.pereira@email.com',
        telefone: '27993332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Lucas Mendes',
        email: 'lucas.mendes@email.com',
        telefone: '27992221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Amanda Silva',
        email: 'amanda.silva@email.com',
        telefone: '27991110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rafael Lima',
        email: 'rafael.lima@email.com',
        telefone: '27990009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Patrícia Rocha',
        email: 'patricia.rocha@email.com',
        telefone: '27989998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Diego Martins',
        email: 'diego.martins@email.com',
        telefone: '27988887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Camila Ferreira',
        email: 'camila.ferreira@email.com',
        telefone: '27987776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Thiago Barbosa',
        email: 'thiago.barbosa@email.com',
        telefone: '27986665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Letícia Nunes',
        email: 'leticia.nunes@email.com',
        telefone: '27985554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Gabriel Castro',
        email: 'gabriel.castro@email.com',
        telefone: '27984443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Isabela Ramos',
        email: 'isabela.ramos@email.com',
        telefone: '27983332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Vinícius Moreira',
        email: 'vinicius.moreira@email.com',
        telefone: '27982221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Laura Duarte',
        email: 'laura.duarte@email.com',
        telefone: '27981110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'André Teixeira',
        email: 'andre.teixeira@email.com',
        telefone: '27980009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Beatriz Cardoso',
        email: 'beatriz.cardoso@email.com',
        telefone: '27979998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Roberto Dias',
        email: 'roberto.dias@email.com',
        telefone: '27978887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Tatiane Moura',
        email: 'tatiane.moura@email.com',
        telefone: '27977776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Leonardo Pires',
        email: 'leonardo.pires@email.com',
        telefone: '27976665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Vanessa Lopes',
        email: 'vanessa.lopes@email.com',
        telefone: '27975554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Eduardo Santos',
        email: 'eduardo.santos@email.com',
        telefone: '27974443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Daniela Costa',
        email: 'daniela.costa@email.com',
        telefone: '27973332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Marcelo Alves',
        email: 'marcelo.alves@email.com',
        telefone: '27972221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Cristina Rocha',
        email: 'cristina.rocha@email.com',
        telefone: '27971110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Paulo Junior',
        email: 'paulo.junior@email.com',
        telefone: '27970009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Renata Silva',
        email: 'renata.silva@email.com',
        telefone: '27969998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Alexandre Moraes',
        email: 'alexandre.moraes@email.com',
        telefone: '27968887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Simone Oliveira',
        email: 'simone.oliveira@email.com',
        telefone: '27967776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Fábio Mendonça',
        email: 'fabio.mendonca@email.com',
        telefone: '27966665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Elaine Torres',
        email: 'elaine.torres@email.com',
        telefone: '27965554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rodrigo Lima',
        email: 'rodrigo.lima@email.com',
        telefone: '27964443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Adriana Souza',
        email: 'adriana.souza@email.com',
        telefone: '27963332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Maurício Reis',
        email: 'mauricio.reis@email.com',
        telefone: '27962221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Priscila Andrade',
        email: 'priscila.andrade@email.com',
        telefone: '27961110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Gustavo Henrique',
        email: 'gustavo.henrique@email.com',
        telefone: '27960009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Larissa Martins',
        email: 'larissa.martins@email.com',
        telefone: '27959998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Hugo Costa',
        email: 'hugo.costa@email.com',
        telefone: '27958887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Natália Rocha',
        email: 'natalia.rocha@email.com',
        telefone: '27957776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Wilson Silva',
        email: 'wilson.silva@email.com',
        telefone: '27956665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Carla Pereira',
        email: 'carla.pereira@email.com',
        telefone: '27955554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Márcio Almeida',
        email: 'marcio.almeida@email.com',
        telefone: '27954443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sueli Santos',
        email: 'sueli.santos@email.com',
        telefone: '27953332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'José Carlos',
        email: 'jose.carlos@email.com',
        telefone: '27952221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rita de Cássia',
        email: 'rita.cassia@email.com',
        telefone: '27951110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Antônio Marcos',
        email: 'antonio.marcos@email.com',
        telefone: '27950009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Maria Eduarda',
        email: 'maria.eduarda@email.com',
        telefone: '27949998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'João Pedro',
        email: 'joao.pedro@email.com',
        telefone: '27948887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Luana Mendes',
        email: 'luana.mendes@email.com',
        telefone: '27947776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Pedro Henrique',
        email: 'pedro.henrique@email.com',
        telefone: '27946665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Raquel Fonseca',
        email: 'raquel.fonseca@email.com',
        telefone: '27945554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Leandro Duarte',
        email: 'leandro.duarte@email.com',
        telefone: '27944443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Monique Alves',
        email: 'monique.alves@email.com',
        telefone: '27943332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Roberta Lima',
        email: 'roberta.lima@email.com',
        telefone: '27942221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Douglas Santos',
        email: 'douglas.santos@email.com',
        telefone: '27941110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Jéssica Oliveira',
        email: 'jessica.oliveira@email.com',
        telefone: '27940009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Ricardo Junior',
        email: 'ricardo.junior@email.com',
        telefone: '27939998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Fernando Costa',
        email: 'fernando.costa@email.com',
        telefone: '27938887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Patrícia Souza',
        email: 'patricia.souza@email.com',
        telefone: '27937776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rogério Martins',
        email: 'rogerio.martins@email.com',
        telefone: '27936665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Aline Ferreira',
        email: 'aline.ferreira@email.com',
        telefone: '27935554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Mário Andrade',
        email: 'mario.andrade@email.com',
        telefone: '27934443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Tânia Rocha',
        email: 'tania.rocha@email.com',
        telefone: '27933332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sérgio Moura',
        email: 'sergio.moura@email.com',
        telefone: '27932221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Cintia Dias',
        email: 'cintia.dias@email.com',
        telefone: '27931110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'José Roberto',
        email: 'jose.roberto@email.com',
        telefone: '27930009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Andressa Lima',
        email: 'andressa.lima@email.com',
        telefone: '27929998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Felipe Santos',
        email: 'felipe.santos@email.com',
        telefone: '27928887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Carolina Almeida',
        email: 'carolina.almeida@email.com',
        telefone: '27927776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Alex Sandro',
        email: 'alex.sandro@email.com',
        telefone: '27926665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Bianca Costa',
        email: 'bianca.costa@email.com',
        telefone: '27925554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rafaela Silva',
        email: 'rafaela.silva@email.com',
        telefone: '27924443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Diego Oliveira',
        email: 'diego.oliveira@email.com',
        telefone: '27923332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Camila Santos',
        email: 'camila.santos@email.com',
        telefone: '27922221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Thiago Lima',
        email: 'thiago.lima@email.com',
        telefone: '27921110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Letícia Souza',
        email: 'leticia.souza@email.com',
        telefone: '27920009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Gabriel Martins',
        email: 'gabriel.martins@email.com',
        telefone: '27919998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Isabela Costa',
        email: 'isabela.costa@email.com',
        telefone: '27918887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Vinícius Alves',
        email: 'vinicius.alves@email.com',
        telefone: '27917776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Laura Ferreira',
        email: 'laura.ferreira@email.com',
        telefone: '27916665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'André Rocha',
        email: 'andre.rocha@email.com',
        telefone: '27915554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Beatriz Lima',
        email: 'beatriz.lima@email.com',
        telefone: '27914443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Roberto Santos',
        email: 'roberto.santos@email.com',
        telefone: '27913332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Tatiane Oliveira',
        email: 'tatiane.oliveira@email.com',
        telefone: '27912221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Leonardo Costa',
        email: 'leonardo.costa@email.com',
        telefone: '27911110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Vanessa Silva',
        email: 'vanessa.silva@email.com',
        telefone: '27910009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Eduardo Lima',
        email: 'eduardo.lima@email.com',
        telefone: '27909998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Daniela Souza',
        email: 'daniela.souza@email.com',
        telefone: '27908887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Marcelo Martins',
        email: 'marcelo.martins@email.com',
        telefone: '27907776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Cristina Costa',
        email: 'cristina.costa@email.com',
        telefone: '27906665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Paulo Silva',
        email: 'paulo.silva@email.com',
        telefone: '27905554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Renata Oliveira',
        email: 'renata.oliveira@email.com',
        telefone: '27904443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Alexandre Lima',
        email: 'alexandre.lima@email.com',
        telefone: '27903332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Simone Costa',
        email: 'simone.costa@email.com',
        telefone: '27902221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Fábio Silva',
        email: 'fabio.silva@email.com',
        telefone: '27901110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Elaine Oliveira',
        email: 'elaine.oliveira@email.com',
        telefone: '27900009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rodrigo Costa',
        email: 'rodrigo.costa@email.com',
        telefone: '27899998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Adriana Silva',
        email: 'adriana.silva@email.com',
        telefone: '27898887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Maurício Oliveira',
        email: 'mauricio.oliveira@email.com',
        telefone: '27897776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Priscila Costa',
        email: 'priscila.costa@email.com',
        telefone: '27896665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Gustavo Silva',
        email: 'gustavo.silva@email.com',
        telefone: '27895554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Larissa Oliveira',
        email: 'larissa.oliveira@email.com',
        telefone: '27894443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Hugo Costa',
        email: 'hugo.costa@email.com',
        telefone: '27893332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Natália Silva',
        email: 'natalia.silva@email.com',
        telefone: '27892221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Wilson Oliveira',
        email: 'wilson.oliveira@email.com',
        telefone: '27891110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Carla Costa',
        email: 'carla.costa@email.com',
        telefone: '27890009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Márcio Silva',
        email: 'marcio.silva@email.com',
        telefone: '27889998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sueli Oliveira',
        email: 'sueli.oliveira@email.com',
        telefone: '27888887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'José Costa',
        email: 'jose.costa@email.com',
        telefone: '27887776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rita Silva',
        email: 'rita.silva@email.com',
        telefone: '27886665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Antônio Oliveira',
        email: 'antonio.oliveira@email.com',
        telefone: '27885554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Maria Costa',
        email: 'maria.costa@email.com',
        telefone: '27884443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'João Silva',
        email: 'joao.silva@email.com',
        telefone: '27883332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Luana Oliveira',
        email: 'luana.oliveira@email.com',
        telefone: '27882221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Pedro Costa',
        email: 'pedro.costa@email.com',
        telefone: '27881110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Raquel Silva',
        email: 'raquel.silva@email.com',
        telefone: '27880009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Leandro Oliveira',
        email: 'leandro.oliveira@email.com',
        telefone: '27879998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Monique Costa',
        email: 'monique.costa@email.com',
        telefone: '27878887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Roberta Silva',
        email: 'roberta.silva@email.com',
        telefone: '27877776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Douglas Oliveira',
        email: 'douglas.oliveira@email.com',
        telefone: '27876665544',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Jéssica Costa',
        email: 'jessica.costa@email.com',
        telefone: '27875554433',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Ricardo Silva',
        email: 'ricardo.silva@email.com',
        telefone: '27874443322',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Fernando Oliveira',
        email: 'fernando.oliveira@email.com',
        telefone: '27873332211',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Patrícia Costa',
        email: 'patricia.costa@email.com',
        telefone: '27872221100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Rogério Silva',
        email: 'rogerio.silva@email.com',
        telefone: '27871110099',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Aline Oliveira',
        email: 'aline.oliveira@email.com',
        telefone: '27870009988',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Mário Costa',
        email: 'mario.costa@email.com',
        telefone: '27869998877',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Tânia Silva',
        email: 'tania.silva@email.com',
        telefone: '27868887766',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sérgio Oliveira',
        email: 'sergio.oliveira@email.com',
        telefone: '27867776655',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Cintia Costa',
        email: 'cintia.costa@email.com',
        telefone: '27866665544',
        createdAt: new Date(),
        updatedAt: new Date()
      }

    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Clientes', null, {});
  }
};