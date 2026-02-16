import {
  calculateRent,
  getCellByMapIdAndOrder,
  getMapById,
} from "../gameHelpers"
import { getGameById } from "../games"
import { mapDesigns } from "../mapDesigns"
import { roles } from "./data"

export const getCellsInBetween = (
  start: number,
  end: number,
  noOfCells: number
) => {
  const cells = []
  if (start < end) {
    for (let i = start; i < end; i++) {
      cells.push(i)
    }
  } else {
    for (let i = start; i < noOfCells; i++) {
      cells.push(i)
    }
    for (let i = 0; i < end; i++) {
      cells.push(i)
    }
  }
  return cells
}

// Dice probability distribution for two 6-sided dice
const getDiceProbabilityDistribution = () => {
  const distribution: { [key: number]: number } = {}

  // Calculate all possible combinations of two dice
  for (let die1 = 1; die1 <= 6; die1++) {
    for (let die2 = 1; die2 <= 6; die2++) {
      const sum = die1 + die2
      distribution[sum] = (distribution[sum] || 0) + 1
    }
  }

  // Convert to probabilities (out of 36 total combinations)
  const totalCombinations = 36
  for (const sum in distribution) {
    distribution[sum] = distribution[sum] / totalCombinations
  }

  return distribution
}

export const calculateRentForProperty = (
  gameid: string,
  propertyOrder: number,
  playerOrder: PlayerOrder
) => {
  const game = getGameById(gameid)
  const cell = getCellByMapIdAndOrder(game.settings.mapId, propertyOrder)
  if (cell.type !== "property") return 0
  const rent = calculateRent(gameid, propertyOrder, playerOrder)
  return rent
}
export const getInGamePlayers = (game: IGame) => {
  return game?.situation?.players?.filter((item) => !item?.isBankrupt)
}
const getRandomDiceRoll = () => {
  return Math.floor(Math.random() * 6) + 1
}
export const getRandomRoll = (): [number, number] => {
  return [getRandomDiceRoll(), getRandomDiceRoll()]
}

export const getRandomRole = () => {
  return roles[Math.floor(Math.random() * roles.length)]
}
export const getExpectedRentInNextTurn = (gameid: string, botId: string) => {
  const game = getGameById(gameid)
  const bot = game?.situation?.players.find((player) => player.id === botId)
  const map = getMapById(game.settings.mapId)
  if (!bot) return 0

  const diceProbabilities = getDiceProbabilityDistribution()
  let totalExpectedRent = 0

  // Calculate expected rent for each possible dice roll (2-12)
  for (let diceSum = 2; diceSum <= 12; diceSum++) {
    const probability = diceProbabilities[diceSum]
    const targetPosition = (bot.position + diceSum) % map.cells.length

    // Calculate rent for the target position
    const rent = calculateRentForProperty(gameid, targetPosition, bot.order)

    // Add to total expected rent (probability * rent)
    totalExpectedRent += probability * rent
  }

  return totalExpectedRent
}
export function normalize(value: number, min: number, max: number): number {
  return (value - min) / (max - min)
}

export function normalizeWithRange(
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
): number {
  // First normalize to 0-1 range
  const normalized = normalize(value, inputMin, inputMax)

  // Then scale to the desired output range
  return normalized * (outputMax - outputMin) + outputMin
}

export function calculateZScore(value: number, data: number[]): number {
  if (data.length === 0) {
    throw new Error("Dataset cannot be empty")
  }

  // Calculate mean
  const mean = data.reduce((sum, x) => sum + x, 0) / data.length

  // Calculate standard deviation
  const squaredDifferences = data.map((x) => Math.pow(x - mean, 2))
  const variance =
    squaredDifferences.reduce((sum, x) => sum + x, 0) / data.length
  const standardDeviation = Math.sqrt(variance)

  if (standardDeviation === 0) {
    throw new Error(
      "Standard deviation cannot be zero (all values are identical)"
    )
  }

  // Calculate z-score
  return (value - mean) / standardDeviation
}

/**
 * Generates all possible subsets of an array up to a maximum size
 * @param arr - The input array
 * @param maxSize - Maximum size of subsets to include (default: no limit)
 * @returns Array of all possible subsets including empty array
 */
export function getAllSubsets<T>(arr: T[], maxSize?: number): T[][] {
  const subsets: T[][] = []
  const n = arr.length
  const maxSubsetSize = maxSize ?? n

  // Generate all possible combinations using bit manipulation
  // For n elements, there are 2^n possible subsets
  for (let i = 0; i < 1 << n; i++) {
    const subset: T[] = []

    // Check each bit position
    for (let j = 0; j < n; j++) {
      // If the j-th bit is set, include the j-th element
      if (i & (1 << j)) {
        subset.push(arr[j])
      }
    }

    // Only include subsets that are within the max size limit
    if (subset.length <= maxSubsetSize) {
      subsets.push(subset)
    }
  }

  return subsets
}
