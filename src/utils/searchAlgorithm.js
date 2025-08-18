const Fuse = require("fuse.js");
const logger = require("./logger");

/**
 * Advanced Product Search Algorithm
 * Implements fuzzy search, relevance scoring, and multiple search criteria
 */
class SearchAlgorithm {
  constructor() {
    this.fuseOptions = {
      // Fuzzy search configuration
      threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
      distance: 100, // Maximum allowed distance
      minMatchCharLength: 2,
      includeScore: true,
      includeMatches: true,

      // Fields to search with different weights
      keys: [
        { name: "name", weight: 0.4 },
        { name: "brand.name", weight: 0.3 },
        { name: "category.name", weight: 0.15 },
        { name: "description", weight: 0.1 },
        { name: "model", weight: 0.25 },
        { name: "keywords", weight: 0.2 },
      ],
    };

    this.searchHistory = new Map();
    this.popularSearches = new Map();
  }

  /**
   * Main search function with multiple algorithms
   * @param {Array} products - Array of products to search
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Search results with metadata
   */
  async search(products, searchParams) {
    const startTime = Date.now();

    try {
      const {
        query = "",
        brand = "",
        category = "",
        minPrice = 0,
        maxPrice = Infinity,
        inStock = false,
        sortBy = "relevance",
        sortOrder = "desc",
        limit = 50,
        offset = 0,
      } = searchParams;

      logger.debug("Starting product search", {
        query,
        brand,
        category,
        minPrice,
        maxPrice,
      });

      // Step 1: Filter products by basic criteria
      let filteredProducts = this.applyBasicFilters(products, {
        brand,
        category,
        minPrice,
        maxPrice,
        inStock,
      });

      // Step 2: Apply text search if query provided
      let searchResults = [];
      if (query && query.trim().length > 0) {
        searchResults = await this.performTextSearch(
          filteredProducts,
          query.trim()
        );
      } else {
        // No text query, return all filtered products with score 1
        searchResults = filteredProducts.map((product) => ({
          item: product,
          score: 1,
          matches: [],
        }));
      }

      // Step 3: Apply advanced scoring and ranking
      searchResults = this.applyAdvancedScoring(searchResults, searchParams);

      // Step 4: Sort results
      searchResults = this.sortResults(searchResults, sortBy, sortOrder);

      // Step 5: Apply pagination
      const totalResults = searchResults.length;
      const paginatedResults = searchResults.slice(offset, offset + limit);

      // Step 6: Log search analytics
      this.logSearchAnalytics(query, totalResults);

      const duration = Date.now() - startTime;
      logger.info("Search completed", {
        query,
        totalResults,
        duration: `${duration}ms`,
        filters: { brand, category, minPrice, maxPrice, inStock },
      });

      return {
        results: paginatedResults.map((result) => ({
          ...result.item,
          _searchScore: result.score,
          _matches: result.matches,
        })),
        metadata: {
          total: totalResults,
          limit,
          offset,
          hasNext: offset + limit < totalResults,
          hasPrev: offset > 0,
          duration,
          query,
          filters: { brand, category, minPrice, maxPrice, inStock },
        },
      };
    } catch (error) {
      logger.error("Search algorithm error", {
        error: error.message,
        searchParams,
      });
      throw error;
    }
  }

  /**
   * Apply basic filters (brand, category, price, stock)
   */
  applyBasicFilters(products, filters) {
    return products.filter((product) => {
      if (filters.brand && product.brand?.slug !== filters.brand) return false;
      if (filters.category && product.category?.slug !== filters.category)
        return false;
      const price = parseFloat(product.price) || 0;
      if (typeof filters.minPrice === "number" && price < filters.minPrice)
        return false;
      if (typeof filters.maxPrice === "number" && price > filters.maxPrice)
        return false;
      if (filters.inStock && product.stock_quantity <= 0) return false;
      if (product.status !== "active") return false;
      return true;
    });
  }

  /**
   * Perform text-based search using multiple algorithms
   */
  async performTextSearch(products, query) {
    const searchableProducts = products.map((product) => ({
      ...product,
      keywords: this.generateKeywords(product),
    }));

    const fuseResults = this.fuzzySearch(searchableProducts, query);
    const exactMatches = this.findExactMatches(searchableProducts, query);
    const partialMatches = this.findPartialMatches(searchableProducts, query);

    return this.combineSearchResults([
      fuseResults,
      exactMatches,
      partialMatches,
    ]);
  }

  /**
   * Fuzzy search using Fuse.js
   */
  fuzzySearch(products, query) {
    const fuse = new Fuse(products, this.fuseOptions);
    const results = fuse.search(query);

    return results.map((result) => ({ ...result, algorithm: "fuzzy" }));
  }

  /**
   * Find exact matches (case-insensitive)
   */
  findExactMatches(products, query) {
    const queryLower = query.toLowerCase();
    const results = [];

    products.forEach((product) => {
      let score = 0;
      let matches = [];

      if (product.name && product.name.toLowerCase().includes(queryLower)) {
        score += 0.9;
        matches.push({ field: "name", value: product.name });
      }

      if (product.model && product.model.toLowerCase().includes(queryLower)) {
        score += 0.8;
        matches.push({ field: "model", value: product.model });
      }

      if (
        product.brand?.name &&
        product.brand.name.toLowerCase().includes(queryLower)
      ) {
        score += 0.7;
        matches.push({ field: "brand", value: product.brand.name });
      }

      if (score > 0) {
        results.push({
          item: product,
          score: Math.min(score, 1),
          matches,
          algorithm: "exact",
        });
      }
    });

    return results;
  }
  // Add inside SearchAlgorithm class (prototype):
  findPartialMatches(products, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const results = [];
    products.forEach((product) => {
      let score = 0;
      let matches = [];
      queryWords.forEach((word) => {
        if (product.name && product.name.toLowerCase().includes(word)) {
          score += 0.3;
          matches.push({ field: "name", value: product.name });
        }
        if (
          product.brand?.name &&
          product.brand.name.toLowerCase().includes(word)
        ) {
          score += 0.2;
          matches.push({ field: "brand", value: product.brand.name });
        }
        if (
          product.category?.name &&
          product.category.name.toLowerCase().includes(word)
        ) {
          score += 0.15;
          matches.push({ field: "category", value: product.category.name });
        }
        if (product.model && product.model.toLowerCase().includes(word)) {
          score += 0.15;
          matches.push({ field: "model", value: product.model });
        }
      });
      if (score > 0) {
        results.push({
          item: product,
          score: Math.min(score, 1),
          matches,
          algorithm: "partial",
        });
      }
    });
    return results;
  }

  /**
   * Generate searchable keywords for a product
   */
  generateKeywords(product) {
    const keywords = [];

    if (product.name) keywords.push(...product.name.toLowerCase().split(/\s+/));
    if (product.brand?.name) keywords.push(product.brand.name.toLowerCase());
    if (product.category?.name)
      keywords.push(product.category.name.toLowerCase());
    if (product.model) keywords.push(product.model.toLowerCase());

    return [
      ...new Set(keywords.filter((keyword) => keyword && keyword.length > 1)),
    ];
  }

  combineSearchResults(resultArrays) {
    const resultsMap = new Map();

    resultArrays.forEach((results) => {
      results.forEach((result) => {
        const productId = result.item.id;
        if (resultsMap.has(productId)) {
          const existing = resultsMap.get(productId);
          existing.score = Math.max(existing.score, result.score);
        } else {
          resultsMap.set(productId, result);
        }
      });
    });

    return Array.from(resultsMap.values());
  }

  applyAdvancedScoring(results, searchParams) {
    return results.map((result) => {
      let score = result.score;
      const product = result.item;

      if (product.is_featured) score *= 1.2;
      if (product.is_bestseller) score *= 1.15;
      if (product.average_rating > 4) score *= 1.1;
      if (product.stock_quantity > 10) score *= 1.05;
      if (product.stock_quantity <= 0) score *= 0.5;

      return { ...result, score: Math.min(score, 1) };
    });
  }

  sortResults(results, sortBy, sortOrder) {
    const orderMultiplier = sortOrder === "asc" ? 1 : -1;

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "relevance":
          comparison = b.score - a.score;
          break;
        case "price":
          comparison =
            (parseFloat(a.item.price) || 0) - (parseFloat(b.item.price) || 0);
          break;
        case "name":
          comparison = a.item.name.localeCompare(b.item.name);
          break;
        case "rating":
          comparison =
            (b.item.average_rating || 0) - (a.item.average_rating || 0);
          break;
        default:
          comparison = b.score - a.score;
      }

      return comparison * orderMultiplier;
    });
  }

  logSearchAnalytics(query, resultCount) {
    if (query) {
      const normalized = query.toLowerCase().trim();
      const count = this.popularSearches.get(normalized) || 0;
      this.popularSearches.set(normalized, count + 1);
    }
  }

  getPopularSearches(limit = 10) {
    return Array.from(this.popularSearches.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }
}

module.exports = SearchAlgorithm;
