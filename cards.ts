import {
  calculateRent,
  getCellByMapIdAndOrder,
  getMapById,
} from "../gameHelpers"
import { getGameById } from "../games"
import { getBotDataById } from "./botsData"
import {
  getAvgMoneyOfOtherPlayers,
  getMoneyNeedInNextRound,
  getOtherPlayersWithMoneyAboveThreshold,
  getPlayerWithMaxMoney,
  getPlayerWithMaxWorth,
} from "./money"
import { getMaxBidPlayerNeedsToWinAnyAuction } from "./auction"
import {
  getColorImportanceOfPropertyForPlayer,
  getColorStatusOfPropertyForPlayer,
  getMostImportantPropertyForPlayer,
  getPlayerWithMaxProperties,
  getPropertiesWithHouses,
} from "./properties"
import { botConstants } from "./data"
import { getCV, getStockStatus } from "./other"
import { brotliCompress } from "zlib"

export type ShouldPlayCardData = {
  targetedPlayerOrder?: PlayerOrder
  targetedPropertyOrder?: number
}
export const shouldBotPlayCard = (
  gameid: string,
  bot: IPlayer,
  cardId: ActionCardId
): boolean | ShouldPlayCardData => {
  const game = getGameById(gameid)
  const botData = getBotDataById(bot.id)
  if (!bot.cards.find((c) => c.cardId === cardId)) return false
  if (cardId === "get-two-more-cards") return true
  if (cardId === "get-10-percent-from-all-players") {
    const totalMoneyOfOtherPlayers = game?.situation?.players
      .filter((player) => player.id !== bot.id)
      .reduce((acc, player) => acc + player.money, 0)
    const threshold =
      botConstants.get10PercentFromAllPlayersThresholdPerPlayer *
      (game.situation.players.length - 1)
    console.log(
      "total money of other players",
      totalMoneyOfOtherPlayers,
      threshold
    )
    if (totalMoneyOfOtherPlayers > threshold) return true
    if (bot.money < 0) return true
  }
  if (cardId === "get-10-percent-from-player") {
    const otherPlayers = game?.situation?.players.filter(
      (player) => player.id !== bot.id
    )
    const playersAboveThreshold = getOtherPlayersWithMoneyAboveThreshold(
      game,
      bot,
      botConstants.get10PercentFromPlayerThreshold
    )
    if (playersAboveThreshold.length > 0) {
      const maxWorthPlayer = getPlayerWithMaxMoney(game, playersAboveThreshold)
      return {
        targetedPlayerOrder: maxWorthPlayer.order,
      }
    }
    return false
  }
  if (cardId === "perform-tax-audit") {
    const otherPlayers = game?.situation?.players.filter(
      (player) => player.id !== bot.id
    )
    const playersAboveThreshold = getOtherPlayersWithMoneyAboveThreshold(
      game,
      bot,
      botConstants.get20PercentFromPlayerThreshold
    )

    if (playersAboveThreshold.length > 0) {
      const maxWorthPlayer = getPlayerWithMaxMoney(game, playersAboveThreshold)
      return {
        targetedPlayerOrder: maxWorthPlayer.order,
      }
    }
    return false
  }
  if (cardId === "apply-property-tax") {
    const otherPlayers = game?.situation?.players.filter(
      (player) => player.id !== bot.id
    )
    const playersAboveThreshold = otherPlayers.filter(
      (player) =>
        player.properties.length >=
        botConstants.propertyTaxThreshold[game.players.length]
    )

    if (playersAboveThreshold.length > 0) {
      const cv = getCV(
        playersAboveThreshold.map((player) => player.properties.length)
      )
      if (cv <= 0.2) {
        const maxWorth = getPlayerWithMaxWorth(game, otherPlayers)
        return {
          targetedPlayerOrder: maxWorth.order,
        }
      }
      const maxPropertiesPlayer = getPlayerWithMaxProperties(
        game,
        playersAboveThreshold
      )

      return {
        targetedPlayerOrder: maxPropertiesPlayer.order,
      }
    }
    return false
  }
  if (cardId === "get-200-from-player") {
    const otherPlayers = game?.situation?.players.filter(
      (player) => player.id !== bot.id
    )
    const playersAboveThreshold = getOtherPlayersWithMoneyAboveThreshold(
      game,
      bot,
      0
    )

    if (playersAboveThreshold.length > 0) {
      const maxWorthPlayer = getPlayerWithMaxWorth(game, playersAboveThreshold)
      return {
        targetedPlayerOrder: maxWorthPlayer.order,
      }
    }
    return false
  }
  if (cardId === "get-interest") {
    if (bot.cards.find((card) => card.cardId === "use-stock-exchange"))
      return false
    if (bot.money > botConstants.getInterestThreshold.mainMoney) {
      if (bot.stock) return false
      else return true
    }
    return false
  }
  if (cardId === "use-stock-exchange") {
    const willCrossGoNextTurn = bot.position + 12 > 40
    const hasMoney = bot.money > 150
    if (willCrossGoNextTurn && hasMoney) return true
    if (bot.money < 0 && bot.stock > 0) return true
    return false
  }
  if (cardId === "purchase-any-property-for-double-price") {
    const map = getMapById(game.settings.mapId)
    const allSoldProperties = game.situation.players.flatMap(
      (player) => player.properties
    )
    const allUnsoldProperties = map.cells.filter(
      (cell) =>
        cell.type === "property" && !allSoldProperties.includes(cell?.order)
    )

    const importantProperty = allUnsoldProperties.find(
      (property) =>
        getColorImportanceOfPropertyForPlayer(game, bot, property.order) >= 2
    )
    if (
      importantProperty &&
      importantProperty.propertyDetails.price <= bot.money
    )
      return { targetedPropertyOrder: importantProperty.order }
    return false
  }
  if (cardId === "forced-auction") {
    const maxMoneyPlayer = getPlayerWithMaxMoney(game, game.situation.players)
    const mostImportantProperty = getMostImportantPropertyForPlayer(game, bot)
    if (mostImportantProperty && mostImportantProperty.property) {
      if (
        maxMoneyPlayer.id === bot.id &&
        mostImportantProperty.importance >= 2
      ) {
        return {
          targetedPropertyOrder: mostImportantProperty?.property?.order,
        }
      }
      const maxBidNeeded = getMaxBidPlayerNeedsToWinAnyAuction(gameid, bot.id)

      if (maxBidNeeded <= 250 && bot.money >= 350)
        return { targetedPropertyOrder: mostImportantProperty.property.order }
      if (maxBidNeeded <= 350 && bot.role === "auction-strategist")
        return { targetedPropertyOrder: mostImportantProperty.property.order }
    }
    const suitableProperties = getSuitablePropertiesForForcedAuction(game, bot)
    if (suitableProperties.length > 0) {
      return { targetedPropertyOrder: suitableProperties[0].order }
    }
    return false
  }
  if (cardId === "advance-to-go") {
    const stockStatus = getStockStatus(game, bot)
    if (bot.money < 0) return true

    if (stockStatus === "max") return false
    if (stockStatus === "mid" && bot.position < 15 && bot.stock >= 300)
      return true
    if (stockStatus === "base" && bot.position < 15 && bot.stock >= 300)
      return true
    return false
  }
  if (cardId === "force-downgrade-property") {
    const otherPlayers = game.situation.players.filter(
      (player) => player.id !== bot.id
    )
    const playerWithHouses = otherPlayers.filter((player) => {
      const propertiesWithHouses = getPropertiesWithHouses(game, player)
      return propertiesWithHouses.length > 0
    })
    if (playerWithHouses.length === 0) return false
    const playerWithMostNetWorth = getPlayerWithMaxWorth(game, playerWithHouses)
    if (!playerWithMostNetWorth) return false

    const propertiesWithHouses = getPropertiesWithHouses(
      game,
      playerWithMostNetWorth
    )
    const highestValueProperty = propertiesWithHouses.sort((a, b) => {
      const cellA = getCellByMapIdAndOrder(game.settings.mapId, a)
      const cellB = getCellByMapIdAndOrder(game.settings.mapId, b)
      return cellB.propertyDetails.price - cellA.propertyDetails.price
    })[0]
    return {
      targetedPropertyOrder: highestValueProperty[0]?.order,
      targetedPlayerOrder: playerWithMostNetWorth.order,
    }
  }

  return false
}
export const getSuitablePropertiesForForcedAuction = (
  game: IGame,
  bot: IPlayer
) => {
  const map = getMapById(game.settings.mapId)
  const otherPlayers = game.situation.players.filter(
    (player) => player.id !== bot.id
  )
  const allSoldProperties = game.situation.players.flatMap(
    (player) => player.properties
  )
  const allUnsoldProperties = map.cells.filter(
    (cell) =>
      cell.type === "property" && !allSoldProperties.includes(cell.order)
  )
  const maxMoneyPlayer = getPlayerWithMaxMoney(game, otherPlayers)
  const suitableProperties = allUnsoldProperties.filter((property) => {
    const propertyStatus = getColorStatusOfPropertyForPlayer(
      game,
      bot,
      property.order
    )
    if (!propertyStatus) return false
    if (
      propertyStatus.total === 2 &&
      propertyStatus.ownersCount === 1 &&
      propertyStatus.sold === 1
    ) {
      const owner = game.situation.players.find(
        (player) => player.order === propertyStatus.owners[0]
      )
      if (
        owner?.money <= 250 &&
        maxMoneyPlayer.id !== bot.id &&
        maxMoneyPlayer.money >= 250
      )
        return true
    }
    if (
      propertyStatus.total === 3 &&
      propertyStatus.ownersCount === 1 &&
      propertyStatus.sold === 2
    ) {
      const owner = game.situation.players.find(
        (player) => player.order === propertyStatus.owners[0]
      )
      if (
        owner?.money <= 350 &&
        maxMoneyPlayer.id !== bot.id &&
        maxMoneyPlayer.money >= 350
      )
        return true
    }
    if (
      propertyStatus.total === 4 &&
      propertyStatus.ownersCount === 1 &&
      propertyStatus.sold === 3
    ) {
      const owner = game.situation.players.find(
        (player) => player.order === propertyStatus.owners[0]
      )
      if (
        owner?.money <= 350 &&
        maxMoneyPlayer.id !== bot.id &&
        maxMoneyPlayer.money >= 350
      )
        return true
    }

    return false
  })
  return suitableProperties
}
export const shouldPlayerPlaySayNoCard = (
  gameid: string,
  botId: string,
  propertyOrder: number,
  rent: number
): boolean => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)
  const otherRents = game.situation.players.filter(
    (player) => player.id !== botId
  )
  const allOtherRents = otherRents.flatMap((player) =>
    player.properties.map((prop) => calculateRent(gameid, prop, bot.order))
  )
  const otherMaxRent = Math.max(...allOtherRents)
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  const rentDifference = otherMaxRent - rent
  if (cell.type !== "property") return false
  if (bot.money - rent <= 0) return true
  if (rent <= 130) return false
  if (rentDifference === 0) return true
  if (rentDifference <= 100) return
}
export const shouldPlayerPlayDoubleTheRent = (
  gameid: string,
  botId: string,
  propertyOrder: number,
  rent: number
): boolean => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)
  const importanceOfProperty = getColorImportanceOfPropertyForPlayer(
    game,
    bot,
    propertyOrder
  )
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (cell.type !== "property") return false
  const maxBidNeeded = getMaxBidPlayerNeedsToWinAnyAuction(gameid, botId)
  if (cell.propertyDetails.price >= maxBidNeeded) return false
  if (importanceOfProperty >= 1.5) return true

  const myProperties = bot.properties.map((item) =>
    getCellByMapIdAndOrder(game.settings.mapId, item)
  )
  const maxRent = Math.max(
    ...myProperties.map((item) => calculateRent(gameid, bot.order, item.order))
  )
  if (rent <= 150) return false
  if (maxRent - rent >= 100) return false
  else return true
}
export const shouldPlayerBuyPropertyWithoutAuctionCard = (
  gameid: string,
  botId: string,
  propertyOrder: number
): boolean => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)
  const importanceOfProperty = getColorImportanceOfPropertyForPlayer(
    game,
    bot,
    propertyOrder
  )
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (cell.type !== "property") return false
  const maxBidNeeded = getMaxBidPlayerNeedsToWinAnyAuction(gameid, botId)
  if (cell.propertyDetails.price >= maxBidNeeded) return false
  if (importanceOfProperty >= 1.5) return true
  return false
}
