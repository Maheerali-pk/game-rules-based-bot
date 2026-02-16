import { getCellByMapIdAndOrder, getMapById } from "../gameHelpers"
import { getGameById } from "../games"
import { getInGamePlayers, normalizeWithRange } from "./botHelpers"
import { botConstants } from "./data"
import { getNeedForBuyingMoreProperties } from "./properties"
import {
  getColorImportanceOfPropertyForPlayer,
  getGeneralImportanceOfPropertyForPlayer,
} from "./properties"

export const getMaxBidPlayerNeedsToWinAnyAuction = (
  gameid: string,
  botId: string
) => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)
  const otherPlayers = game?.situation?.players.filter(
    (player) => player.id !== bot.id
  )
  const maxMoneyOtherPlayerHave = Math.max(
    ...otherPlayers.map((player) => player.money)
  )
  return maxMoneyOtherPlayerHave
}
export const getMoneyNeededForAuctionsForNextRound = (
  game: IGame,
  bot: IPlayer
) => {
  const otherPlayers = game?.situation?.players.filter(
    (player) => player.id !== bot.id
  )
  const noOfAuctionsInNextRound = getExpectAuctionedPropertiesInNextRound(
    game,
    bot
  )
  const needForBuyingMoreProperties =
    getNeedForBuyingMoreProperties(game, bot) * 1
  const moneyNeededForAuctions =
    noOfAuctionsInNextRound * 300 * needForBuyingMoreProperties
  return moneyNeededForAuctions
}
export const getExpectAuctionedPropertiesInNextRound = (
  game: IGame,
  bot: IPlayer
) => {
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const allPropeties = game.situation.players.flatMap(
    (player) => player.properties
  )
  const map = getMapById(game.settings.mapId)
  const unsoldProperties = map.cells.filter(
    (item) => !allPropeties.includes(item.order)
  )
  const nonBankruptPlayers = game.situation.players.filter((p) => !p.isBankrupt)
  return (
    (unsoldProperties.length / 40) *
    nonBankruptPlayers.length *
    botConstants.safePlayFactor
  )
}
export const getAuctionBid = (
  game: IGame,
  bot: IPlayer,
  propertyOrder: number
) => {
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (cell.type !== "property") return 0
  const colorImportanceForPlayer = getColorImportanceOfPropertyForPlayer(
    game,
    bot,
    propertyOrder
  )
  const baseImportanceForPlayer = getGeneralImportanceOfPropertyForPlayer(
    game,
    bot,
    propertyOrder
  )
  const needForBuyingMoreProperties =
    getNeedForBuyingMoreProperties(game, bot) * 1.1
  const importance = baseImportanceForPlayer * 0.75 + colorImportanceForPlayer
  const inGamePlayers = getInGamePlayers(game)
  const avgMoney =
    inGamePlayers.reduce((acc, player) => acc + player.money, 0) /
    inGamePlayers.length
  const myMoneyScale = isNaN(bot.money / avgMoney) ? 1 : bot.money / avgMoney
  const roleAdvantage = bot.role === "auction-strategist" ? 1.25 : 1
  const absoluteMoneyFactor = normalizeWithRange(bot.money, 0, 1500, 0.75, 1)
  const calculatedBid = Math.floor(
    importance *
      roleAdvantage *
      needForBuyingMoreProperties *
      myMoneyScale *
      absoluteMoneyFactor *
      160 +
      Math.random() * baseImportanceForPlayer * 100
  )
  const safeBidThreshold = Math.random() * 150
  const maxBidNeeded = getMaxBidPlayerNeedsToWinAnyAuction(game.id, bot.id)
  if (calculatedBid > maxBidNeeded) {
    return maxBidNeeded
  }
  if (bot.money - calculatedBid < safeBidThreshold) {
    const newBid = Math.floor(bot.money - safeBidThreshold)
    if (newBid < bot.money) return 0
    else return newBid
  }
  if (calculatedBid > bot.money) return bot.money - 100
  return calculatedBid
}
