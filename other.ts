import { stockBaseRate } from "../constants"
import { getCellByMapIdAndOrder, getMapById } from "../gameHelpers"
import { getGameById } from "../games"
import { getAuctionBid, getMaxBidPlayerNeedsToWinAnyAuction } from "./auction"
import { shouldBotPlayCard } from "./cards"
import {
  getMaxRentInNextTurn,
  getMoneyNeedInNextRound,
  getRentDataForNextRound,
} from "./money"
import { getColorImportanceOfPropertyForPlayer, getColorStatusOfPropertyForPlayer, getGeneralImportanceOfPropertyForPlayer, getPropertiesOfPlayerWhichCompleteHisSet, getPropertiesWhichCompleteSetOfOtherPlayer } from "./properties"

/**
 * Calculates the coefficient of variation for an array of numbers
 * Coefficient of variation = (Standard Deviation / Mean) * 100
 * @param numbers Array of numbers
 * @returns Coefficient of variation as a percentage, or null if array is empty or has zero mean
 */
export const getCV = (numbers: number[]): number | null => {
  if (numbers.length === 0) return null

  // Calculate mean
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length

  if (mean === 0) return null

  // Calculate variance
  const variance =
    numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) /
    numbers.length

  // Calculate standard deviation
  const standardDeviation = Math.sqrt(variance)

  // Calculate coefficient of variation (as percentage)
  const coefficientOfVariation = (standardDeviation / mean) * 100

  return coefficientOfVariation
}

export const chooseDecisionHubOption = (
  gameid: string,
  botId: string
): DecisionHubOption => {
  const game = getGameById(gameid)
  const bot = game.situation.players.find((player) => player.id === botId)
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== botId
  )
  const avgMoney =
    otherPlayers.reduce((ac, a) => ac + a.money, 0) / otherPlayers.length
  const avgMoneyFactor = avgMoney / 1000
  const maxMoney = Math.max(...otherPlayers.map((item) => item.money))
  const maxMoneyFactor = maxMoney / 1500
  const maxProperties = Math.max(
    ...otherPlayers.map((item) => item.properties.length)
  )
  const maxPropertiesFactor =
    (maxProperties / (28 / game.situation.players.length)) * 0.2
  const moneyInStocksFactor = bot.stock ? bot.stock * 500 : 0
  const roleFactor = bot.role === "wall-street-wolf" ? 0.8 : 0.5
  const expectedRentInNextRound = getRentDataForNextRound(game, bot)
  const expectedAvgRentFactor = expectedRentInNextRound.avg / 70
  const shouldGetCards =
    avgMoneyFactor +
    maxMoneyFactor +
    maxPropertiesFactor +
    moneyInStocksFactor +
    roleFactor +
    expectedAvgRentFactor
  if (shouldGetCards > 1.5) return "cards"
  return "money"
}
export const getStockStatus = (game: IGame, bot: IPlayer) => {
  const atMaxStocks =
    (bot.stockMultiplier === 1 + stockBaseRate * 2 &&
      bot.role !== "wall-street-wolf" &&
      bot.stock) ||
    (bot.stockMultiplier === 1 + stockBaseRate * 4 &&
      bot.role === "wall-street-wolf" &&
      bot.stock)
  const atMidStocks =
    (bot.stockMultiplier === 1 + stockBaseRate * 1 &&
      bot.role !== "wall-street-wolf" &&
      bot.stock) ||
    (bot.stockMultiplier === 1 + stockBaseRate * 2 &&
      bot.role === "wall-street-wolf" &&
      bot.stock)
  if (atMaxStocks) return "max"
  if (atMidStocks) return "mid"
  if (bot.stockMultiplier === 1) return "base"
  return "none"
}

export const shouldPrivatelyBuyProperty = (
  game: IGame,
  bot: IPlayer,
  propertyOrder: number
): boolean => {
  const map = getMapById(game.settings.mapId)
  const propertiesOfPlayerCompletingSet = getPropertiesOfPlayerWhichCompleteHisSet(game, bot)
  const propertiesWhichCompleteSetOfOtherPlayer = getPropertiesWhichCompleteSetOfOtherPlayer(game, bot)
  if (propertiesOfPlayerCompletingSet.some(item => item.propertyOrder === propertyOrder)) return true
  if (propertiesWhichCompleteSetOfOtherPlayer.some(item => item.propertyOrder === propertyOrder)) return true;

  const allPropeties = game.situation.players.flatMap(
    (player) => player.properties
  )
  const soldProperties = map.cells.filter((item) =>
    allPropeties.includes(item.order)

  )
  const soldPropertiesPercentage = soldProperties.length / map.cells.filter(item => item.type === "property").length
  if (soldPropertiesPercentage > 0.8) return true;
  return false
}
export const getStockExchangeResponse = (
  game: IGame,
  bot: IPlayer
): IStockExchangeResponse | "hold" => {
  debugger
  const stockStatus = getStockStatus(game, bot)
  const playerHaveAdvanceToGoCard = bot.cards.find(
    (item) => item.id === "advance-to-go"
  )
  if (!game) {
    return "hold"
  }
  const playerGonnaPlayAdvanceToGoCardNow = shouldBotPlayCard(
    game?.id,
    bot,
    "advance-to-go"
  )
  if (bot.money < 0 && bot.stock > 0) {
    return {
      roomid: game.id,
      action: "retrieved",
      money: 0,
    }
  }
  if (stockStatus === "max")
    return {
      roomid: game.id,
      action: "retrieved",
      money: 0,
    }
  if (stockStatus === "mid") {
    const moneyNeedForNextRound = getMoneyNeedInNextRound(game, bot)
    if (playerHaveAdvanceToGoCard && playerGonnaPlayAdvanceToGoCardNow)
      return "hold"
    if (bot.money < moneyNeedForNextRound) {
      return {
        roomid: game.id,
        action: "retrieved",
        money: moneyNeedForNextRound,
      }
    } else
      return {
        roomid: game.id,
        action: "dismissed",
        money: 0,
      }
  }
  const usedStockExchange = bot.position + 10 >= 40
  if (usedStockExchange) {
    const moneyNeedInNextTurn = getMaxRentInNextTurn(game, bot)
    return {
      roomid: game.id,
      action: "invested",
      money: bot.money - moneyNeedInNextTurn,
    }
  }
  if (playerHaveAdvanceToGoCard) {
    return {
      roomid: game.id,
      action: "invested",
      money: bot.money,
    }
  }
  const moneyNeedForNextRound = getMoneyNeedInNextRound(game, bot)
  const moneyToInvest = bot.money - moneyNeedForNextRound
  console.log(
    moneyNeedForNextRound,
    "money needed for next round",
    moneyToInvest,
    bot.order
  )
  if (moneyToInvest > 150) {
    return {
      roomid: game.id,
      action: "invested",
      money: moneyToInvest,
    }
  }
}
