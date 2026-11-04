import { dataLocal, imagemBase64, instante, toPessoaDetalheDeAssociado } from './associado.adapter';

/** Formato que o Jackson gera para `Associado` (getters do Lombok, byte[] em base64). */
function associadoJson(): Record<string, unknown> {
  return {
    id: 501,
    ultimaAdesao: '2024-03-10T12:00:00Z',
    primeiraAdesao: '2023-02-01T13:20:00Z',
    pessoa: {
      id: 77,
      data_cadastro: '2023-02-01T13:20:00Z',
      imgPerfil: '/9j/4AAQSkZJRgABAQAAAQABAAD',
      nome: 'Maria das Graças Souza',
      cpf: '52998224725',
      matricula: '123456',
      naturalidade: 'Maceió/AL',
      nomeMae: 'Josefa Souza',
      nomePai: 'Severino Souza',
      rg: '2000001',
      tituloEleitor: '012345678901',
      data_nascimento: '1984-07-19',
      tipo: { id: 1, nome: 'AFILIADO' },
      sexo: { id: 2, sexo: 'Feminino' },
      nome_guerra: 'Graças',
      estadoCivil: { id: 1, nome: 'Casada' },
      email: 'maria@exemplo.com',
      assinatura: null,
      status: 'ATIVO',
      carteiraImpressa: true,
      carteiraEntregue: false,
      qrcodeValidador: 'iVBORw0KGgoAAAANSUhEUgAAAAE',
      tokenValidador: 'abc',
      endereco: { id: 9, cep: '57020000', logradouro: 'Rua do Comércio', numero: '101', complemento: null, estado: { id: 2, nome: 'Alagoas', sigla: 'AL' }, cidade: 'Maceió', bairro: 'Centro' },
      telefones: [
        { id: 2, telefone: '8233214455', principal: false },
        { id: 1, telefone: '82999998888', principal: true },
      ],
      conta: { id: 4, banco: { id: 104, nome: 'Caixa Econômica Federal' }, tipoConta: 'Corrente', agencia: '0055', numeroConta: '10001-3', tipoPix: { id: 1, tipo: 'CPF' }, chavePix: '52998224725' },
      restricao: null,
    },
    tipoVinculo: { id: 1, nome: 'MILITAR' },
    instituicao: { id: 20, nome: 'Polícia Militar de Alagoas', tipoVinculo: { id: 1, nome: 'MILITAR' } },
    unidade: { id: 9, nome: '1º BPM' },
    graduacao: { id: 3, nome: 'Cabo' },
    quadro: { id: 2, nome: 'QPMP-0' },
    tipoSocio: { id: 1, nome: 'Efetivo' },
    formaPagamento: { id: 1, forma: 'Desconto em folha' },
    data_incorporacao: '2008-05-02',
    associadoIndicador: { id: 300, pessoa: { id: 40, nome: 'José Carlos Albuquerque' } },
    status: 'ATIVO',
    motivo_desligamento: null,
    codigoCadastramento: 'CAD-000501',
    dataDesligamento: null,
    empresaConveniada: null,
    valorCredito: 12.5,
    restricao: 'NÃO',
    usuario: { id: 1 },
  };
}

describe('toPessoaDetalheDeAssociado', () => {
  it('usa o id da Pessoa (rotas e lista) e guarda o id do Associado à parte', () => {
    const d = toPessoaDetalheDeAssociado(associadoJson())!;
    expect(d.id).toBe(77);
    expect(d.associadoId).toBe(501);
    expect(d.origem).toBe('api');
    expect(d.perfil).toBe('membro');
    expect(d.tipoNome).toBe('AFILIADO');
  });

  it('lê os campos com "_" gerados pelo Lombok e as entidades auxiliares', () => {
    const d = toPessoaDetalheDeAssociado(associadoJson())!;
    expect(d.pessoais.nomeGuerra).toBe('Graças');
    expect(d.pessoais.dataNascimento).toBe('1984-07-19');
    expect(d.pessoais.sexo).toBe('Feminino');
    expect(d.pessoais.estadoCivil).toBe('Casada');
    expect(d.pessoais.tituloEleitor).toBe('012345678901');
    expect(d.dataCadastro).toBe('2023-02-01T13:20:00Z');
    expect(d.vinculo).toEqual({
      tipoVinculo: 'MILITAR',
      instituicao: 'Polícia Militar de Alagoas',
      unidade: '1º BPM',
      graduacao: 'Cabo',
      quadro: 'QPMP-0',
      dataIncorporacao: '2008-05-02',
      empresaConveniada: null,
    });
    expect(d.adesao?.formaPagamento).toBe('Desconto em folha');
    expect(d.adesao?.valorCredito).toBe(12.5);
    expect(d.adesao?.indicador).toEqual({ id: 40, nome: 'José Carlos Albuquerque' });
    expect(d.endereco?.estado).toBe('Alagoas');
    expect(d.bancarios?.banco).toBe('Caixa Econômica Federal');
    expect(d.bancarios?.tipoPix).toBe('CPF');
    expect(d.carteira).toEqual({ impressa: true, entregue: false });
    expect(d.desligamento).toBeNull();
  });

  it('põe o telefone principal primeiro e converte as imagens', () => {
    const d = toPessoaDetalheDeAssociado(associadoJson())!;
    expect(d.telefones[0]).toEqual({ telefone: '82999998888', principal: true });
    expect(d.foto?.startsWith('data:image/jpeg;base64,/9j/')).toBe(true);
    expect(d.qrcode?.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('monta o desligamento a partir de dataDesligamento e motivo_desligamento', () => {
    const raw = associadoJson();
    raw['status'] = 'DESLIGADO';
    raw['dataDesligamento'] = '2026-03-10T15:00:00Z';
    raw['motivo_desligamento'] = 'A pedido';
    expect(toPessoaDetalheDeAssociado(raw)?.desligamento).toEqual({
      data: '2026-03-10T15:00:00Z',
      motivo: 'A pedido',
    });
  });

  it('rejeita respostas sem pessoa, sem id ou sem nome', () => {
    expect(toPessoaDetalheDeAssociado(null)).toBeNull();
    expect(toPessoaDetalheDeAssociado({ id: 1 })).toBeNull();
    expect(toPessoaDetalheDeAssociado({ id: 1, pessoa: { nome: 'Sem id' } })).toBeNull();
  });
});

describe('versão do backend com Date, foto em texto e Conta com numero_conta/pix', () => {
  it('lê os nomes dessa versão', () => {
    const raw = associadoJson();
    const pessoa = raw['pessoa'] as Record<string, unknown>;
    delete pessoa['imgPerfil'];
    pessoa['foto'] = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg';
    pessoa['data_nascimento'] = '1984-07-19';
    pessoa['conta'] = { id: 1, agencia: '0055', operacao: '013', numero_conta: '10001-3', banco: { id: 1, nome: 'Caixa' }, tipoPix: { id: 1, tipo: 'CPF' }, pix: '52998224725' };
    delete raw['tipoVinculo'];
    raw['primeiraAdesao'] = '2023-02-01';
    raw['data_incorporacao'] = '2008-05-02';
    const d = toPessoaDetalheDeAssociado(raw)!;
    expect(d.foto).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg');
    expect(d.bancarios).toEqual({ banco: 'Caixa', tipoConta: null, agencia: '0055', operacao: '013', numeroConta: '10001-3', tipoPix: 'CPF', chavePix: '52998224725' });
    expect(d.adesao?.primeiraAdesao).toBe('2023-02-01');
    expect(d.vinculo?.tipoVinculo).toBeNull();
    expect(d.vinculo?.dataIncorporacao).toBe('2008-05-02');
  });
});

describe('leitores de datas e imagens', () => {
  it('aceita LocalDate em texto ou em lista', () => {
    expect(dataLocal({ d: '2008-05-02' }, ['d'])).toBe('2008-05-02');
    expect(dataLocal({ d: [2008, 5, 2] }, ['d'])).toBe('2008-05-02');
    expect(dataLocal({ d: '1990-04-12T03:00:00.000+00:00' }, ['d'])).toBe('1990-04-12');
    expect(dataLocal({ d: new Date(2008, 4, 2).getTime() }, ['d'])).toBe('2008-05-02');
    expect(dataLocal({ d: 'x' }, ['d'])).toBeNull();
  });

  it('aceita Instant em texto ou em segundos', () => {
    expect(instante({ t: 1675257600 }, ['t'])).toBe('2023-02-01T13:20:00.000Z');
    expect(instante({ t: '2023-02-01T13:20:00Z' }, ['t'])).toBe('2023-02-01T13:20:00Z');
  });

  it('só gera imagem para formatos reconhecidos', () => {
    expect(imagemBase64('AAAAAAAAAAAAAAAAAAAA')).toBeNull();
    expect(imagemBase64(null)).toBeNull();
    expect(imagemBase64('<svg onload=alert(1)>xxxxxxxxxxx')).toBeNull();
  });
});
