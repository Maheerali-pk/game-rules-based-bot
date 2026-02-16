import { Player } from "aws-sdk/clients/gamelift"
import { getGameById } from "../games"
import {
  calculateZScore,
  getAllSubsets,
  getInGamePlayers,
  normalize,
  normalizeWithRange,
} from "./botHelpers"
import { botsData, getBotDataById } from "./botsData"
import {
  getColorImportanceOfPropertyForPlayer,
  getColorStatusOfPropertyForPlayer,
  getGeneralImportanceOfPropertyForPlayer,
  getNoOfCompletedSets,
  getPropertiesInCompletedSetsOfPlayer,
  getPropertiesOfPlayerWhichCompleteHisSet,
  getPropertiesOtherPlayersNeedFromYou,
} from "./properties"
import { BounceControllerApi } from "mailslurp-client"
import { getPlayerWithMaxMoney } from "./money"
import { getCellByMapIdAndOrder, getMapById } from "../gameHelpers"
import _ = require("lodash")
export const reverseTrade = (trade: ITrade) => {
  return {
    ...trade,
    givenProperties: trade.takenProperties,
    takenProperties: trade.givenProperties,
    moneyGiven: trade.moneyTaken,
    moneyTaken: trade.moneyGiven,
  }
}
export const getDirectPossiblePropertyExchanges = (
  gameid: string,
  botId: string
) => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)

  const propertiesPlayerNeed = getPropertiesOfPlayerWhichCompleteHisSet(
    game,
    bot
  )

  const propertiesOtherPlayersNeedFromYou =
    getPropertiesOtherPlayersNeedFromYou(game, bot)

  return propertiesPlayerNeed.flatMap((needed) => {
    const possibleExchanges = propertiesOtherPlayersNeedFromYou.filter(
      (canGive) => needed.ownerOrder === canGive.neederOrder
    )
    return possibleExchanges.flatMap((exchange) => ({
      givenProperty: exchange.propertyOrder,
      wantedProperty: needed.propertyOrder,
      offeredPlayerOrder: exchange.neederOrder,
    }))
  })
}
const getOtherImportantPropertiesForPlayer = (
  game: IGame,
  botId: string,
  otherPlayerOrder: number,
  excludingProperties: number[]
) => {
  const bot = game.situation?.players.find((player) => player.id === botId)
  const otherPlayer = game.situation?.players.find(
    (player) => player.order === otherPlayerOrder
  )
  const availableProperties = bot.properties.filter(
    (property) => !excludingProperties.includes(property)
  )
  const availablePropertiesImportance = availableProperties.map((property) => ({
    propertyOrder: property,
    importance:
      getGeneralImportanceOfPropertyForPlayer(game, otherPlayer, property) +
      getColorImportanceOfPropertyForPlayer(game, otherPlayer, property),
  }))
  const sortedPropertiesImportance = availablePropertiesImportance.sort(
    (a, b) => b.importance - a.importance
  )
  return sortedPropertiesImportance.map((property) => property.propertyOrder)
}
export const getPossibleExchangesOnExcessMoneyOrProperties = (
  game: IGame,
  botId: string
) => {
  const bot = game.situation?.players.find((player) => player.id === botId)
  const propertiesINeed = getPropertiesOfPlayerWhichCompleteHisSet(game, bot)

  const playersWhoHaveMyProperties = game.situation?.players.filter((player) =>
    player.properties.some((property) =>
      propertiesINeed.some((needed) => needed.propertyOrder === property)
    )
  )

  return propertiesINeed.map((needed) => {
    const map = getMapById(game?.settings?.mapId)
    const property = getCellByMapIdAndOrder(
      game?.settings?.mapId,
      needed?.propertyOrder
    )
    const groupId = property?.propertyDetails?.groupId
    const propertiesInGroup = map?.cells.filter(
      (cell) => cell.propertyDetails?.groupId === groupId
    )
    const myOtherImportantProperties = getOtherImportantPropertiesForPlayer(
      game,
      botId,
      needed.ownerOrder,
      propertiesInGroup.map((cell) => cell.order)
    )

    return {
      givenProperty: undefined,
      wantedProperty: needed.propertyOrder,
      offeredPlayerOrder: needed.ownerOrder,
    }
  })
}

export const getPossibleExchanges = (game: IGame, botId: string) => {
  const directExchanges = getDirectPossiblePropertyExchanges(game.id, botId)
  const bot = game.situation?.players.find((player) => player.id === botId)
  // const moneyOnlyExchanges = getPossibleExchangesOnExcessMoneyOrProperties(
  //   game,
  //   botId
  // )
  // if (moneyOnlyExchanges.length > 0 && directExchanges.length === 0) {
  //   return moneyOnlyExchanges
  // }
  if (directExchanges.length === 0) {
    const propertiesINeed = getPropertiesOfPlayerWhichCompleteHisSet(game, bot)
    const playersWhoHaveMyProperties = game.situation?.players.filter(
      (player) =>
        player.properties.some((property) =>
          propertiesINeed.some((needed) => needed.propertyOrder === property)
        )
    )
    if (playersWhoHaveMyProperties.length === 0) return []
    const propertiesOtherPlayersNeedFromYou =
      getPropertiesOtherPlayersNeedFromYou(game, bot)
    const propertiesTheyNeedFromAnyoneElse = playersWhoHaveMyProperties.flatMap(
      (player) => {
        const propertiesTheyNeed = getPropertiesOfPlayerWhichCompleteHisSet(
          game,
          player
        )
        return propertiesTheyNeed
      }
    )
    const propertiesICouldGetForThem = propertiesTheyNeedFromAnyoneElse.flatMap(
      (needed) => {
        const possibleExchanges = propertiesOtherPlayersNeedFromYou.filter(
          (canGive) => needed.ownerOrder === canGive.neederOrder
        )
        return possibleExchanges.flatMap((exchange) => ({
          givenProperty: exchange.propertyOrder,
          wantedProperty: needed.propertyOrder,
          offeredPlayerOrder: exchange.neederOrder,
        }))
      }
    )
    return propertiesICouldGetForThem
  }
  return directExchanges
}

const compareArrays = (arr1: number[], arr2: number[]) => {
  if (arr1.length !== arr2.length) return false
  return arr1.every((item) => arr2.includes(item))
}
const compareTrades = (trade1: ITrade, trade2: ITrade) => {
  if (trade1.offeredPlayerOrder !== trade2.offeredPlayerOrder) return false
  if (trade1.offeringPlayerOrder !== trade2.offeringPlayerOrder) return false
  if (!compareArrays(trade1.givenProperties, trade2.givenProperties))
    return false
  if (!compareArrays(trade1.takenProperties, trade2.takenProperties))
    return false
  // if (trade1.moneyGiven !== trade2.moneyGiven) return false
  // if (trade1.moneyTaken !== trade2.moneyTaken) return false
  return true
}

// export const getInBetweenTradeForBot = (game: IGame, botId: string, trade: ITrade) => {
//   const bot = game.situation?.players.find((player) => player.id === botId)
//   const otherPlayer = game.situation?.players.find(
//     (player) => player.order === trade.offeredPlayerOrder
//   )
//   const propertiesWhichCompleteSetOfBot = getPropertiesOfPlayerWhichCompleteHisSet(game, bot)

//   const propertiesWhichCompleteSetOfOtherPlayer = getPropertiesOfPlayerWhichCompleteHisSet(game, otherPlayer)

// }

export const correntTheMoneyInTradeOffered = (
  game: IGame,
  botId: string,
  trade: ITrade,
  loops: number = 0
): ITrade => {
  // debugg`er
  const reversedTrade = reverseTrade(trade)
  const fairnessOfTradeForMe = getFairnessOfTrade(game, botId, {
    ...reversedTrade,
    offeredPlayerOrder: trade.offeringPlayerOrder,
    offeringPlayerOrder: trade.offeredPlayerOrder,
  })
  const otherPlayerId = game.situation?.players.find(
    (player) => player.order === trade.offeredPlayerOrder
  )?.id
  const fairnessOfTradeForOtherPlayer = getFairnessOfTrade(
    game,
    otherPlayerId,
    trade
  )
  const tradeFairForMe = fairnessOfTradeForMe + Math.random() * 0

  const tradeFairForOtherPlayer =
    fairnessOfTradeForOtherPlayer + Math.random() * 0
  const netTradeFactor = tradeFairForMe - tradeFairForOtherPlayer
  if (loops > 40) {
    return undefined
  }
  if (fairnessOfTradeForMe < 0) {
    if (trade.moneyGiven > 0) {
      const moneyToReduce = 25
      const newTrade = {
        ...trade,
        moneyGiven: trade.moneyGiven - moneyToReduce,
      }
      return correntTheMoneyInTradeOffered(game, botId, newTrade, loops + 1)
    }
    const moneyToDemand = 50
    const newTrade = {
      ...trade,

      moneyTaken: trade.moneyTaken + moneyToDemand,
    }
    return correntTheMoneyInTradeOffered(game, botId, newTrade, loops + 1)
  }
  if (fairnessOfTradeForMe > 0.2) {
    if (trade.moneyTaken > 0) {
      const moneyToGiveToOtherPlayer = trade.moneyTaken
      const newTrade = {
        ...trade,
        moneyTaken: trade.moneyTaken - 25,
      }
      return correntTheMoneyInTradeOffered(game, botId, newTrade, loops + 1)
    }

    const moneyToGiveToOtherPlayer = 50
    const newTrade = {
      ...trade,
      moneyGiven: trade.moneyGiven + moneyToGiveToOtherPlayer,
    }
    return correntTheMoneyInTradeOffered(game, botId, newTrade, loops + 1)
  }

  if (fairnessOfTradeForMe >= 0) {
    return trade
  }
}

export const getPropertyMoneyWhenPlayerIsBankrupt = (
  game: IGame,
  botId: string,
  otherPlayerId: string,
  propertyOrder: number
) => {
  const bot = game.situation?.players.find((player) => player.id === botId)
  const otherPlayer = game.situation?.players.find(
    (player) => player.id === otherPlayerId
  )
  const importanceOfProperty =
    getGeneralImportanceOfPropertyForPlayer(game, otherPlayer, propertyOrder) +
    getColorImportanceOfPropertyForPlayer(game, otherPlayer, propertyOrder)

  return Math.floor(
    importanceOfProperty *
    (100 * normalizeWithRange(otherPlayer.money, 0, 1000, 0.5, 1))
  )
}
// export const botOfferForOtherPlayer = (
//   game: IGame,
//   botId: string,
//   otherPlayerId: string
// ): ITrade => {
//   const bot = game.situation?.players.find((player) => player.id === botId)
//   const otherPlayer = game.situation?.players.find(
//     (player) => player.id === otherPlayerId
//   )
//   let negativeMoney = bot.money
//   const propertiesToGive = []
//   const moneyGains = bot.properties.map((property) => ({
//     propertyOrder: property,
//     money: getPropertyMoneyWhenPlayerIsBankrupt(
//       game,
//       botId,
//       otherPlayerId,
//       property
//     ),
//   }))
//   for (let i = 0; i < moneyGains.length; i++) {
//     if (moneyGains[i].money > 0) {
//       propertiesToGive.push(moneyGains[i].propertyOrder)
//       negativeMoney += moneyGains[i].money
//     }
//     if (negativeMoney > 0) {
//       break
//     }
//   }
//   return {
//     givenProperties: propertiesToGive,
//     takenProperties: [],
//     moneyGiven: 0,
//     moneyTaken: Math.abs(bot.money - negativeMoney),
//     offeredPlayerOrder: otherPlayer.order,
//     offeringPlayerOrder: bot.order,
//   }
// }
export const getTradeToBeOfferedDuringBankruptcy = (
  game: IGame,
  botId: string
) => {
  const bot = game.situation?.players.find((player) => player.id === botId)
  const otherPlayers = game.situation?.players.filter(
    (player) => player.id !== botId
  )

  const possibleTrades: ITrade[] = bot.properties.flatMap(
    (property) =>
      otherPlayers.map((player) => ({
        givenProperties: [property],
        takenProperties: [],
        moneyGiven: 0,
        moneyTaken: getPropertyMoneyWhenPlayerIsBankrupt(
          game,
          botId,
          player.id,
          property
        ),
        offeredPlayerOrder: player.order,
        offeringPlayerOrder: bot.order,
      })) as ITrade[]
  )
  return possibleTrades.find(
    (trade) =>
      !getBotDataById(botId).tradeOfferHistory.some((alreadyOfferedTrade) =>
        compareTrades(trade, alreadyOfferedTrade)
      )
  )
}

export const replaceMoneyWithProperties = (
  game: IGame,
  botId: string,
  trade: ITrade
) => {
  // debugger
  const bot = game.situation?.players.find((player) => player.id === botId)
  const otherPlayer = game.situation?.players.find(
    (player) => player.order === trade.offeredPlayerOrder
  )
  if (trade.moneyGiven) {
    const moneyLeft = bot.money - trade.moneyGiven
    const safeMoneyToKeep = Math.floor(Math.random() * 400)
    if (moneyLeft > safeMoneyToKeep) {
      return trade
    } else {
      const propertiesWhichCompleteSetOfOtherPlayer =
        getPropertiesOtherPlayersNeedFromYou(game, otherPlayer)
      //Get those properties which are not in trade and doesn't complete set of other player
      const otherPropertiesWhichPlayerCanGive = bot.properties.filter(
        (property) =>
          !trade.givenProperties.includes(property) &&
          !propertiesWhichCompleteSetOfOtherPlayer.some(
            (prop) => prop.propertyOrder === property
          )
      )
      const allPossibleSubsets = getAllSubsets(
        otherPropertiesWhichPlayerCanGive,
        3
      )
      const importanceOfSubsets = allPossibleSubsets.map((subset) => ({
        subset: subset,
        money: getMoneyValueOfPropertiesForPlayer(game, otherPlayer, subset),
      }))
      const moneyDifferences = importanceOfSubsets.map((item) => ({
        subsetData: item,
        moneyDiff: item.money - trade.moneyTaken,
      }))
      const sortedMoneyDifferences = moneyDifferences
        .sort((a, b) => a.moneyDiff - b.moneyDiff)
        .filter((item) => item.moneyDiff >= 0)
      const bestSubset = sortedMoneyDifferences[0]
      if (sortedMoneyDifferences.length === 0) return undefined
      return {
        ...trade,
        moneyGiven: Math.abs(trade.moneyGiven - bestSubset.subsetData.money),
        givenProperties: [
          ...trade.givenProperties,
          ...bestSubset.subsetData.subset,
        ],
      }
    }
  }
  if (trade.moneyTaken) {
    const moneyLeft = otherPlayer.money - trade.moneyTaken
    const safeMoneyToKeep = Math.floor(Math.random() * 400)
    const safeMoneyOtherCanGive = otherPlayer.money - safeMoneyToKeep
    const moneyToReplace = Math.abs(trade.moneyTaken - safeMoneyOtherCanGive)
    if (moneyLeft > safeMoneyToKeep) {
      return trade
    } else {
      const propertiesWhichCompleteSetOfBot =
        getPropertiesOfPlayerWhichCompleteHisSet(game, bot)
      //Get those properties which are not in trade and doesn't complete set of other player
      const otherPropertiesWhichBotCanAskFor = otherPlayer.properties.filter(
        (property) => {
          const cell = getCellByMapIdAndOrder(game.settings.mapId, property)
          const tradedProperties = trade.givenProperties.map((property) =>
            getCellByMapIdAndOrder(game?.settings?.mapId, property)
          )

          return (
            !trade.takenProperties.includes(property) &&
            !propertiesWhichCompleteSetOfBot.some(
              (prop) => prop.propertyOrder === property
            ) &&
            !tradedProperties.some(
              (prop) =>
                prop.propertyDetails.groupId === cell.propertyDetails.groupId
            )
          )
        }
      )
      const allPossibleSubsets = getAllSubsets(
        otherPropertiesWhichBotCanAskFor,
        3
      )
      const importanceOfSubsets = allPossibleSubsets.map((subset) => ({
        subset: subset,
        money: getMoneyValueOfPropertiesForPlayer(game, bot, subset),
      }))
      const moneyDifferences = importanceOfSubsets.map((item) => ({
        subsetData: item,
        moneyDiff: moneyToReplace - item.money,
      }))
      const sortedMoneyDifferences = moneyDifferences
        .sort((a, b) => a.moneyDiff - b.moneyDiff)
        .filter((item) => item.moneyDiff >= 0)
      const bestSubset = sortedMoneyDifferences[0]
      if (sortedMoneyDifferences.length === 0) return undefined
      return {
        ...trade,
        moneyTaken: safeMoneyOtherCanGive,
        takenProperties: [
          ...trade.takenProperties,
          ...bestSubset.subsetData.subset,
        ],
      }
      // const sortedImportances = importancesChangedToMoney.sort(
    }
  }
}
export const getMoneyValueOfPropertiesForPlayer = (
  game: IGame,
  player: IPlayer,
  properties: number[]
): number => {
  return Math.floor(
    properties.reduce((acc, curr) => {
      const property = getCellByMapIdAndOrder(game.settings.mapId, curr)
      const importance =
        getColorImportanceOfPropertyForPlayer(game, player, curr) * 0.5 +
        getGeneralImportanceOfPropertyForPlayer(game, player, curr)
      return acc + importance * 300
    }, 0)
  )
}

export const getTradeToBeOffered = (
  gameid: string,
  botId: string
): ITrade | undefined => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)
  console.log(botsData, "bots data", game, botId)
  const alreadyOfferedTrades = getBotDataById(botId).tradeOfferHistory
  const propertiesPlayerNeed = getPropertiesOfPlayerWhichCompleteHisSet(
    game,
    bot
  )
  const possiblePropertyExchanges = getPossibleExchanges(game, botId)

  if (propertiesPlayerNeed.length === 0) return null
  const possibleTrades = possiblePropertyExchanges.map((exchange) => ({
    givenProperties: exchange.givenProperty ? [exchange.givenProperty] : [],
    takenProperties: [exchange.wantedProperty],
    offeredPlayerOrder: exchange.offeredPlayerOrder,
    offeringPlayerOrder: bot.order,
    moneyGiven: 0,
    moneyTaken: 0,
  }))
  const tradeToBeOffered = possibleTrades.find(
    (trade) =>
      !alreadyOfferedTrades.some((alreadyOfferedTrade) =>
        compareTrades(trade, alreadyOfferedTrade)
      )
  )
  if (!tradeToBeOffered) {
    return null
  }
  const moneyCorrectedTrade = correntTheMoneyInTradeOffered(
    game,
    botId,
    tradeToBeOffered
  )
  if (!moneyCorrectedTrade) return undefined
  const moneyAndPropertiesCorrectedTrade = replaceMoneyWithProperties(
    game,
    botId,
    moneyCorrectedTrade
  )
  if (alreadyOfferedTrades.some((alreadyOfferedTrade) =>
    compareTrades(moneyAndPropertiesCorrectedTrade, alreadyOfferedTrade)
  )) return undefined;
  if (!moneyAndPropertiesCorrectedTrade) return undefined
  return moneyAndPropertiesCorrectedTrade
}

export const getAvgNoOfCompletedSets = (game: IGame) => {
  const inGamePlayers = getInGamePlayers(game)
  const propertiesInCompletedSets = inGamePlayers.map((player) =>
    getNoOfCompletedSets(game, player)
  )
  const avgNoOfCompletedSets =
    propertiesInCompletedSets.reduce((acc, curr) => acc + curr, 0) /
    inGamePlayers.length
  return avgNoOfCompletedSets
}
export const getAvgNoOfHouses = (game: IGame) => {
  const inGamePlayers = getInGamePlayers(game)

  const totalHouseCount = game.situation.housesData.reduce(
    (acc, curr) => acc + curr.houses,
    0
  )
  const avgNoOfHouses = totalHouseCount / inGamePlayers.length
  return avgNoOfHouses
}
export const getTotalHouseCountOfPlayer = (game: IGame, player: IPlayer) => {
  const houses = game.situation.housesData.filter((item) =>
    player.properties.includes(item.propertyOrder)
  )
  const totalHouseCount = houses.reduce((acc, curr) => acc + curr.houses, 0)
  return totalHouseCount
}
const roleToAttitudeFactor: Record<GameRoleId, number> = {
  "auction-strategist": 0.5,
  "card-stealer": 0.6,
  "rent-lord": 0.65,
  "wall-street-wolf": 0.6,
  "private-buyer": 0.5,
  financer: 0.62,
  "the-constructor": 0.5,
  none: 0.5,
}
export const calculateAttitudeTowardsTrade = (
  game: IGame,
  botId: string
): number => {
  return 0
  const bot = game.situation?.players.find((player) => player.id === botId)
  const propertiesInCompletedSets = getPropertiesInCompletedSetsOfPlayer(
    game,
    bot
  )
  const completedSets = Array.from(
    new Set(propertiesInCompletedSets.map((item) => item.groupId))
  )
  const roleFactor = roleToAttitudeFactor[bot.role]
  const avgNoOfCompletedSets = getAvgNoOfCompletedSets(game)
  const completedSetsFactor = (completedSets.length / avgNoOfCompletedSets) * 2
  const housesFactor =
    getAvgNoOfHouses(game) / getTotalHouseCountOfPlayer(game, bot)
  const attitudeTowardsTrade =
    roleFactor +
    (isNaN(completedSetsFactor) ? 0 : completedSetsFactor) +
    (isNaN(housesFactor) ? 0 : housesFactor)
  return attitudeTowardsTrade
}
export const getAvgMoney = (game: IGame) => {
  const inGamePlayers = getInGamePlayers(game)
  const avgMoney =
    inGamePlayers.reduce((acc, curr) => acc + curr.money, 0) /
    inGamePlayers.length
  return avgMoney
}
export const getRichnessFactor = (game: IGame, bot: IPlayer) => {
  const avgMoney = getAvgMoney(game)
  const moneyFactor = bot.money / avgMoney
  return moneyFactor
}
export const getAverageGeneralImportanceOfPropertiesForPlayer = (
  game: IGame,
  bot: IPlayer,
  properties: number[]
) => {
  const generalImportanceOfProperties = properties.map((item) =>
    getGeneralImportanceOfPropertyForPlayer(game, bot, item)
  )
  const totalImportance = generalImportanceOfProperties.reduce(
    (acc, curr) => acc + curr,
    0
  )
  const avgImportance = totalImportance / generalImportanceOfProperties.length
  return isNaN(avgImportance) ? 0 : avgImportance
}
export const shouldAcceptTrade = (
  game: IGame,
  botId: string,
  trade: ITrade
): boolean => {
  const bot = game.situation?.players.find((player) => player.id === botId)
  const offeringPlayer = game.situation?.players.find(
    (player) => player.order === trade.offeringPlayerOrder
  )
  const propertiesNeededToCompleteMySets =
    getPropertiesOfPlayerWhichCompleteHisSet(game, bot)
  const mySetsGettingCompleted = propertiesNeededToCompleteMySets.filter(
    (property) => trade.givenProperties.includes(property.propertyOrder)
  )

  const propertiesOtherPlayerNeedToCompleteHisSets =
    getPropertiesOfPlayerWhichCompleteHisSet(game, offeringPlayer)
  const otherPlayersSetsGettingCompleted =
    propertiesOtherPlayerNeedToCompleteHisSets.filter((property) =>
      trade.takenProperties.includes(property.propertyOrder)
    )
  const offeringPlayerAttitudeTowardsTrade = calculateAttitudeTowardsTrade(
    game,
    offeringPlayer.id
  )
  const myAttitudeTowardsTrade = calculateAttitudeTowardsTrade(game, botId)

  const offeringPlayerRichnessFactor = getRichnessFactor(game, offeringPlayer)
  const myRichnessFactor = getRichnessFactor(game, bot)
  const averageMoney = getAvgMoney(game)
  const propertiesGivenFactor =
    getAverageGeneralImportanceOfPropertiesForPlayer(
      game,
      offeringPlayer,
      trade.givenProperties
    ) * trade.givenProperties.length
  const propertiesTakenFactor =
    getAverageGeneralImportanceOfPropertiesForPlayer(
      game,
      bot,
      trade.takenProperties
    ) * trade.takenProperties.length

  const acceptFactor =
    propertiesGivenFactor +
    mySetsGettingCompleted.length +
    myRichnessFactor * 0.5 +
    offeringPlayerAttitudeTowardsTrade * 0.5 +
    (trade.moneyGiven / averageMoney) * 0.5
  const rejectFactor =
    propertiesTakenFactor +
    otherPlayersSetsGettingCompleted.length +
    offeringPlayerRichnessFactor * 0.5 +
    myAttitudeTowardsTrade * 0.5 +
    (trade.moneyTaken / averageMoney) * 2
  return acceptFactor > rejectFactor
}

export const getCompletedSetsForAllPlayers = (game: IGame) => {
  const inGamePlayers = getInGamePlayers(game)
  const completedSets = inGamePlayers.map((player) =>
    getNoOfCompletedSets(game, player)
  )
  return completedSets
}

export const getFairnessOfTrade = (
  game: IGame,
  botId: string,
  trade: ITrade
) => {
  const bot = game.situation?.players.find((player) => player.id === botId)
  const otherPlayer = game.situation?.players.find(
    (player) => player.order === trade.offeringPlayerOrder
  )
  const setsGettingCompleted = trade.givenProperties.map((property) => {
    const colorStatus = getColorStatusOfPropertyForPlayer(game, bot, property)
    if (colorStatus.total === 2 && colorStatus.ownedByPlayer === 1) return true
    if (colorStatus.total === 3 && colorStatus.ownedByPlayer === 2) return true
    if (colorStatus.total === 4 && colorStatus.ownedByPlayer === 3) return true
    return false
  })
  const setsGettingCompletedForOtherPlayer = trade.takenProperties
    .map((property) => {
      const colorStatus = getColorStatusOfPropertyForPlayer(
        game,
        otherPlayer,
        property
      )
      if (colorStatus.total === 2 && colorStatus.ownedByPlayer === 1)
        return true
      if (colorStatus.total === 3 && colorStatus.ownedByPlayer === 2)
        return true
      if (colorStatus.total === 4 && colorStatus.ownedByPlayer === 3)
        return true
      return false
    })
    .filter(Boolean)

  const givenPropsImportance = trade.givenProperties.map((property) =>
    getGeneralImportanceOfPropertyForPlayer(game, bot, property)
  )
  const takenPropsImportance = trade.takenProperties.map((property) =>
    getGeneralImportanceOfPropertyForPlayer(game, bot, property)
  )
  const totalGivenPropsImportance = givenPropsImportance.reduce(
    (acc, curr) => acc + curr,
    0
  )
  const totalTakenPropsImportance = takenPropsImportance.reduce(
    (acc, curr) => acc + curr,
    0
  )

  const avgMoney = getAvgMoney(game)
  const maxMoney = Math.max(
    ...game.situation.players.map((player) => player.money)
  )
  const currentLiquidityOfBot = normalizeWithRange(
    bot.money,
    0,
    maxMoney,
    0.5,
    1
  )
  const currentLiquidityOfOtherPlayer = normalizeWithRange(
    otherPlayer.money,
    0,
    maxMoney,
    0.5,
    1
  )

  const liquidityOfBotAfterTradeFactor = normalizeWithRange(
    otherPlayer.money + trade.moneyTaken - trade.moneyGiven,
    0,
    1500,
    0.5,
    1
  )
  const liquidityOfOtherPlayerAfterTradeFactor = normalizeWithRange(
    otherPlayer.money + trade.moneyTaken - trade.moneyGiven,
    0,
    1500,
    0.5,
    1
  )
  const moneyGivenFactor = normalize(trade.moneyGiven, 0, 500)
  const moneyTakenFactor = normalize(trade.moneyTaken, 0, 500)
  const givenPropsImportanceFactor = normalize(totalGivenPropsImportance, 0, 1)
  const takenPropsImportanceFactor = normalize(totalTakenPropsImportance, 0, 1)

  const acceptFactor =
    setsGettingCompleted.length * 8 +
    givenPropsImportanceFactor * 5 +
    moneyGivenFactor * 2.5 * (currentLiquidityOfBot * 1)
  // liquidityOfBotAfterTradeFactor * 0.5
  const rejectFactor =
    setsGettingCompletedForOtherPlayer.length * 8 +
    takenPropsImportanceFactor * 5 +
    moneyTakenFactor * 2.5 * (currentLiquidityOfOtherPlayer * 1)
  // liquidityOfOtherPlayerAfterTradeFactor * 0.5
  return acceptFactor - rejectFactor
}

export const shouldAcceptTrade2 = (
  game: IGame,
  botId: string,
  trade: ITrade
): boolean => {
  debugger
  const fairnessOfTrade = getFairnessOfTrade(game, botId, trade)
  if (fairnessOfTrade > 0) {
    return true
  }
  return false
}
