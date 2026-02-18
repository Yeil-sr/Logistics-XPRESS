'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Hubs', [
  {
    "nome": "Hub São Paulo 20",
    "codigo_hub": "SP20",
    "endereco_id": 74,
    "createdAt": "2025-01-24T00:03:58",
    "updatedAt": "2025-07-19T15:23:51"
  },
  {
    "nome": "Hub Salvador 12",
    "codigo_hub": "BA12",
    "endereco_id": 17,
    "createdAt": "2025-05-25T15:32:29",
    "updatedAt": "2025-01-09T20:50:22"
  },
  {
    "nome": "Hub Belo Horizonte 14",
    "codigo_hub": "MG14",
    "endereco_id": 81,
    "createdAt": "2025-01-17T06:41:16",
    "updatedAt": "2025-01-26T07:25:40"
  },
  {
    "nome": "Hub Rio de Janeiro 13",
    "codigo_hub": "RJ13",
    "endereco_id": 53,
    "createdAt": "2025-02-01T18:07:53",
    "updatedAt": "2025-07-09T04:28:34"
  },
  {
    "nome": "Hub Vitória 18",
    "codigo_hub": "ES18",
    "endereco_id": 66,
    "createdAt": "2025-06-30T07:08:34",
    "updatedAt": "2025-02-15T11:19:42"
  },
  {
    "nome": "Hub Belo Horizonte 19",
    "codigo_hub": "MG19",
    "endereco_id": 41,
    "createdAt": "2025-03-13T15:08:06",
    "updatedAt": "2025-01-14T12:47:59"
  },
  {
    "nome": "Hub Belo Horizonte 2",
    "codigo_hub": "MG02",
    "endereco_id": 39,
    "createdAt": "2025-03-09T08:37:00",
    "updatedAt": "2025-02-27T16:05:01"
  },
  {
    "nome": "Hub Fortaleza 15",
    "codigo_hub": "CE15",
    "endereco_id": 87,
    "createdAt": "2025-02-03T13:17:39",
    "updatedAt": "2025-06-07T09:14:51"
  },
  {
    "nome": "Hub Belo Horizonte 4",
    "codigo_hub": "MG04",
    "endereco_id": 97,
    "createdAt": "2025-03-18T07:16:03",
    "updatedAt": "2025-05-23T11:40:39"
  },
  {
    "nome": "Hub Vitória 14",
    "codigo_hub": "ES14",
    "endereco_id": 42,
    "createdAt": "2025-02-17T15:41:46",
    "updatedAt": "2025-01-27T21:44:45"
  },
  {
    "nome": "Hub Salvador 19",
    "codigo_hub": "BA19",
    "endereco_id": 3,
    "createdAt": "2025-03-12T02:19:58",
    "updatedAt": "2025-07-21T16:16:52"
  },
  {
    "nome": "Hub Fortaleza 9",
    "codigo_hub": "CE09",
    "endereco_id": 54,
    "createdAt": "2025-01-04T18:02:16",
    "updatedAt": "2025-02-22T19:42:05"
  },
  {
    "nome": "Hub Porto Alegre 15",
    "codigo_hub": "RS15",
    "endereco_id": 24,
    "createdAt": "2025-02-28T16:15:00",
    "updatedAt": "2025-02-25T13:12:57"
  },
  {
    "nome": "Hub Vitória 11",
    "codigo_hub": "ES11",
    "endereco_id": 13,
    "createdAt": "2025-03-09T15:04:55",
    "updatedAt": "2025-01-27T12:23:37"
  },
  {
    "nome": "Hub Manaus 5",
    "codigo_hub": "AM05",
    "endereco_id": 34,
    "createdAt": "2025-01-01T22:17:09",
    "updatedAt": "2025-04-01T02:58:34"
  },
  {
    "nome": "Hub Belo Horizonte 2",
    "codigo_hub": "MG02",
    "endereco_id": 52,
    "createdAt": "2025-04-01T14:11:17",
    "updatedAt": "2025-03-19T05:09:41"
  },
  {
    "nome": "Hub Fortaleza 1",
    "codigo_hub": "CE01",
    "endereco_id": 45,
    "createdAt": "2025-06-21T23:00:08",
    "updatedAt": "2025-02-20T16:14:22"
  },
  {
    "nome": "Hub Salvador 4",
    "codigo_hub": "BA04",
    "endereco_id": 46,
    "createdAt": "2025-03-14T22:32:33",
    "updatedAt": "2025-03-11T16:04:24"
  },
  {
    "nome": "Hub Recife 4",
    "codigo_hub": "PE04",
    "endereco_id": 52,
    "createdAt": "2025-05-24T23:46:08",
    "updatedAt": "2025-08-03T16:30:51"
  },
  {
    "nome": "Hub Salvador 19",
    "codigo_hub": "BA19",
    "endereco_id": 79,
    "createdAt": "2025-05-11T16:41:39",
    "updatedAt": "2025-02-08T23:38:43"
  },
  {
    "nome": "Hub Recife 18",
    "codigo_hub": "PE18",
    "endereco_id": 61,
    "createdAt": "2025-02-13T07:23:25",
    "updatedAt": "2025-05-22T11:43:03"
  },
  {
    "nome": "Hub São Paulo 8",
    "codigo_hub": "SP08",
    "endereco_id": 43,
    "createdAt": "2025-03-05T05:40:38",
    "updatedAt": "2025-06-11T10:10:33"
  },
  {
    "nome": "Hub Belo Horizonte 15",
    "codigo_hub": "MG15",
    "endereco_id": 77,
    "createdAt": "2025-06-24T15:05:59",
    "updatedAt": "2025-06-12T02:24:31"
  },
  {
    "nome": "Hub Rio de Janeiro 7",
    "codigo_hub": "RJ07",
    "endereco_id": 33,
    "createdAt": "2025-07-13T10:54:59",
    "updatedAt": "2025-06-05T10:26:10"
  },
  {
    "nome": "Hub Manaus 10",
    "codigo_hub": "AM10",
    "endereco_id": 38,
    "createdAt": "2025-06-08T22:18:42",
    "updatedAt": "2025-07-12T08:35:04"
  },
  {
    "nome": "Hub Recife 17",
    "codigo_hub": "PE17",
    "endereco_id": 90,
    "createdAt": "2025-05-17T16:19:25",
    "updatedAt": "2025-04-27T02:36:49"
  },
  {
    "nome": "Hub Manaus 16",
    "codigo_hub": "AM16",
    "endereco_id": 6,
    "createdAt": "2025-04-25T22:26:40",
    "updatedAt": "2025-03-03T10:04:58"
  },
  {
    "nome": "Hub Porto Alegre 3",
    "codigo_hub": "RS03",
    "endereco_id": 56,
    "createdAt": "2025-04-06T12:56:11",
    "updatedAt": "2025-04-09T10:39:13"
  },
  {
    "nome": "Hub Vitória 7",
    "codigo_hub": "ES07",
    "endereco_id": 25,
    "createdAt": "2025-06-20T08:45:35",
    "updatedAt": "2025-06-11T06:39:58"
  },
  {
    "nome": "Hub Curitiba 3",
    "codigo_hub": "PR03",
    "endereco_id": 100,
    "createdAt": "2025-08-05T20:55:21",
    "updatedAt": "2025-03-31T22:46:57"
  },
  {
    "nome": "Hub Curitiba 10",
    "codigo_hub": "PR10",
    "endereco_id": 3,
    "createdAt": "2025-02-06T01:19:53",
    "updatedAt": "2025-05-17T07:18:27"
  },
  {
    "nome": "Hub Vitória 9",
    "codigo_hub": "ES09",
    "endereco_id": 65,
    "createdAt": "2025-01-24T06:51:32",
    "updatedAt": "2025-06-18T02:31:56"
  },
  {
    "nome": "Hub Vitória 11",
    "codigo_hub": "ES11",
    "endereco_id": 15,
    "createdAt": "2025-02-14T14:17:05",
    "updatedAt": "2025-04-28T02:00:55"
  },
  {
    "nome": "Hub Vitória 9",
    "codigo_hub": "ES09",
    "endereco_id": 43,
    "createdAt": "2025-03-01T17:38:47",
    "updatedAt": "2025-02-08T04:56:11"
  },
  {
    "nome": "Hub Vitória 5",
    "codigo_hub": "ES05",
    "endereco_id": 82,
    "createdAt": "2025-04-27T23:34:15",
    "updatedAt": "2025-01-25T11:15:55"
  },
  {
    "nome": "Hub Belo Horizonte 11",
    "codigo_hub": "MG11",
    "endereco_id": 42,
    "createdAt": "2025-03-02T05:16:48",
    "updatedAt": "2025-03-11T18:37:14"
  },
  {
    "nome": "Hub Porto Alegre 8",
    "codigo_hub": "RS08",
    "endereco_id": 63,
    "createdAt": "2025-03-04T10:07:39",
    "updatedAt": "2025-05-27T07:09:35"
  },
  {
    "nome": "Hub Curitiba 10",
    "codigo_hub": "PR10",
    "endereco_id": 46,
    "createdAt": "2025-05-31T05:03:53",
    "updatedAt": "2025-03-18T17:35:05"
  },
  {
    "nome": "Hub Belo Horizonte 18",
    "codigo_hub": "MG18",
    "endereco_id": 6,
    "createdAt": "2025-02-21T20:08:34",
    "updatedAt": "2025-04-08T00:12:01"
  },
  {
    "nome": "Hub Fortaleza 20",
    "codigo_hub": "CE20",
    "endereco_id": 95,
    "createdAt": "2025-04-04T08:20:59",
    "updatedAt": "2025-06-28T07:15:21"
  },
  {
    "nome": "Hub Fortaleza 13",
    "codigo_hub": "CE13",
    "endereco_id": 64,
    "createdAt": "2025-04-08T18:16:22",
    "updatedAt": "2025-07-11T05:57:43"
  },
  {
    "nome": "Hub Fortaleza 15",
    "codigo_hub": "CE15",
    "endereco_id": 47,
    "createdAt": "2025-05-28T04:10:16",
    "updatedAt": "2025-06-05T12:46:57"
  },
  {
    "nome": "Hub Manaus 5",
    "codigo_hub": "AM05",
    "endereco_id": 54,
    "createdAt": "2025-03-01T03:01:59",
    "updatedAt": "2025-08-01T19:22:12"
  },
  {
    "nome": "Hub São Paulo 3",
    "codigo_hub": "SP03",
    "endereco_id": 41,
    "createdAt": "2025-03-13T02:33:33",
    "updatedAt": "2025-02-25T09:20:32"
  },
  {
    "nome": "Hub Vitória 12",
    "codigo_hub": "ES12",
    "endereco_id": 20,
    "createdAt": "2025-07-11T04:38:50",
    "updatedAt": "2025-05-31T03:35:42"
  },
  {
    "nome": "Hub Recife 16",
    "codigo_hub": "PE16",
    "endereco_id": 19,
    "createdAt": "2025-07-26T13:46:06",
    "updatedAt": "2025-06-23T21:53:21"
  },
  {
    "nome": "Hub São Paulo 2",
    "codigo_hub": "SP02",
    "endereco_id": 79,
    "createdAt": "2025-03-02T14:39:49",
    "updatedAt": "2025-06-16T11:14:42"
  },
  {
    "nome": "Hub Vitória 7",
    "codigo_hub": "ES07",
    "endereco_id": 80,
    "createdAt": "2025-04-24T05:02:30",
    "updatedAt": "2025-06-28T16:07:01"
  },
  {
    "nome": "Hub Recife 2",
    "codigo_hub": "PE02",
    "endereco_id": 52,
    "createdAt": "2025-06-04T22:26:25",
    "updatedAt": "2025-01-30T19:40:37"
  },
  {
    "nome": "Hub Porto Alegre 12",
    "codigo_hub": "RS12",
    "endereco_id": 97,
    "createdAt": "2025-02-10T20:17:12",
    "updatedAt": "2025-02-05T18:11:28"
  }
], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Hubs', null, {});
  }
};
