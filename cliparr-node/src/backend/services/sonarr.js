const axios = require('axios');

class SonarrAPI {
  constructor() {
    this.baseURL = process.env.SONARR_URL;
    this.apiKey = process.env.SONARR_API_KEY;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Api-Key': this.apiKey
      }
    });
  }

  async fetchSeries() {
    try {
      const response = await this.client.get('/series');
      return response.data;
    } catch (error) {
      console.error('Error fetching series:', error);
      throw error;
    }
  }

  async fetchEpisodes(seriesId) {
    try {
      const response = await this.client.get(`/episode?seriesId=${seriesId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching episodes:', error);
      throw error;
    }
  }

  async fetchEpisodeFiles(seriesId) {
    try {
      const response = await this.client.get(`/episodefile?seriesId=${seriesId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching episode files:', error);
      throw error;
    }
  }
}

module.exports = new SonarrAPI(); 