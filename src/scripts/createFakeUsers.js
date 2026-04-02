import { faker } from '@faker-js/faker';
import axios from 'axios';

import BotUser from '../models/users/BotUser';
import VipTier from '../models/vip/VipTier';
import { generateAvatarUrl } from '../utils/helpers';
import { logger } from '../utils/logger';

//disable eslint

const brazilianUsernames = [
  'ZeDoPix',
  'NeyGanhador',
  'XandeCravador',
  'BetandoRJ',
  'LoucoPorOdds',
  'Riquinho22',
  'JoaoSniper',
  'CassineroBR',
  'PalpiteiroTop',
  'BrunoBetando',
  'OtavioMilGrau',
  'JogaSeco',
  'ReiDoCash',
  'Luquinhas777',
  'SorteLoka',
  'PorradeiroRJ',
  'CassinoDoVini',
  'MoedaNaConta',
  'TricolorApostador',
  'VitinFTW',
  'MegaRafa',
  'BaianoCrava',
  'X1doPix',
  'BetDosCria',
  'CassinoVipRJ',
  'PedraoAposta',
  'MitoNaOdd',
  'TioDaZebra',
  'Betfixado',
  'CravadorPRO',
  'ZikaDaBanca',
  'RaulPixado',
  'JJPalpite',
  'AleDoCash',
  'TigrinhoNet',
  'VipGanhador',
  'BotDoMagrin',
  'FelipeCravaTudo',
  'ReiDaZebra',
  'GodDoAviator',
  'FoguinhoAposta',
  '7doPix',
  'PalpiteCria',
  'AlePixRJ',
  'ZNdoCassino',
  'CaioMandaBem',
  'LipeApostaAlta',
  'BruxoDasOdds',
  'NaldoDaRoleta',
  'PixadoVIP',
  'SniperRJ22',
  'CravinhaTop',
  'DuduBetando',
  'BetRJCria',
  'LulaPixado',
  'TioDaBanca',
  'JogadorSecreto',
  'ApostadorMX',
  'RodriguinCrava',
  'ReiDoCrash',
  'ZéCravaSeco',
  'CaioGolGol',
  'ViciadoNaZebra',
  'MilNaConta',
  'LipeZikaBet',
  'AviatorBruto',
  'CravadaoBR',
  'Mandrakinho22',
  'PixadorOculto',
  'NegoDoCassino',
  'RatoDasOdds',
  'LeozinGanhaFacil',
  'BoladaoRJ',
  'TioVIPBet',
  'CaioCravador',
  'BrenoDoPix',
  'JhowApostador',
  'PikachuNaOdd',
  'BetCria777',
  'VavaDaAposta',
  'TeuzinCravador',
  'GolDoPix',
  'XapadoDasOdds',
  'ManoCassino',
  'VictorPixado',
  'TiagoMilGrau',
  'LocoPorAviator',
  'SniperDoSul',
  'JogaNaSeca',
  'MasterCrava',
  'DuduNaRoleta',
  'CravinhaRJ',
  'ZKdaZebra',
  'Fofolete777',
  'CaioZikaBR',
  'BetandoHard',
  'CassinoDoNando',
  'BrunãoDaAposta',
  'DonoDoCrash',
  'ReiDoPIX',
];

export const fetchRandomUser = async (gender) => {
  try {
    const response = await axios.get('https://randomuser.me/api/', {
      params: {
        gender,
        nat: 'br',
      },
    });

    return response.data.results[0];
  } catch (error) {
    console.error('Error fetching random user:', error);
    return null;
  }
};

export const createFakeUsers = async () => {
  const check_bot_users = await BotUser.findOne({ bot_user: true });
  const vipTiers = await VipTier.find({});
  const ranks = vipTiers.map((vipTier) => {
    return vipTier.name;
  });

  if (check_bot_users) {
    logger.info('Bot users already exist');
    return;
  }

  for (let i = 0; i < 100; i++) {
    // Determine gender based on 8:2 ratio
    const gender = i % 10 < 8 ? 'male' : 'female';
    const randomUser = await fetchRandomUser(gender);

    const botUser = {
      username: randomUser.login.username,
      avatar: generateAvatarUrl(randomUser.login.username),
      rank: ranks[faker.number.int({ min: 1, max: 10 }) % ranks.length],
      wager: faker.number.int({ min: 1, max: 2000 }),
    };

    logger.info(`Bot Created: ${botUser.username}`);

    await BotUser.create(botUser);
  }
  logger.info('All have done!');

  //eslint-disable-next-line
  process.exit(0);
};

export const updateFakeUsers = async () => {
  const botUsers = await BotUser.find({});
  for (let i = 0; i < botUsers.length; i++) {
    botUsers[i].username = brazilianUsernames[i % brazilianUsernames.length];

    botUsers[i].avatar = generateAvatarUrl(botUsers[i].username);
    botUsers[i].maxMultiplier = 20;
    botUsers[i].minMultiplier = 1.1;
    botUsers[i].maxBet = 500;
    botUsers[i].minBet = 1;
    await botUsers[i].save();
  }
  process.exit(0);
};

export const deleteFakeUsers = async () => {
  await BotUser.deleteMany({});
};
