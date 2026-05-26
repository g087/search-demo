// app.js
const client = algoliasearch('L93WNOJ0R4', '35cd687bf80000c678f91ae50fff6323');

const helper = algoliasearchHelper(client, 'restaurant_index', {
  disjunctiveFacets: ['city', 'cuisine_cat', 'payment_options', 'price_range'],
  hitsPerPage: 9
});

const input = document.getElementById('searchbox');
const resultsContainer = document.getElementById('results');
const facetsContainer = document.getElementById('facets');
const paginationContainer = document.getElementById('pagination');
const nextButtonWrapper = document.getElementById('next-button-wrapper');
const statsContainer = document.getElementById('stats');
const locationIndicator = document.getElementById('location-indicator');
const locationTooltip = document.getElementById('location-tooltip');
const locationMessage = document.getElementById('location-message');

// State to track expanded facets and facet search
const state = {
  expandedFacets: {
    city: false,
    cuisine_cat: false
  },
  facetSearch: {
    city: ''
  },
  location: null
};

input.addEventListener('input', (e) => {
  helper.setQuery(e.target.value).setPage(0).search();
});

helper.on('result', (event) => {
  const content = event.results;
  renderStats(content);
  renderHits(content);
  renderFacets(content);
  renderPagination(content);
  renderNextButton(content);
});

helper.on('error', (err) => {
  console.error('Algolia Search Error:', err);
  resultsContainer.innerHTML = `<div style="padding: 1rem; color: #e63946;">Error: ${err.message}.</div>`;
});

function renderStats(content) {
  statsContainer.innerHTML = `Showing ${content.hits.length} of ${content.nbHits.toLocaleString()} total restaurants`;
  
  // Manage location message visibility and content
  if (state.location) {
    locationMessage.textContent = 'Results are enhanced by your current location';
    locationMessage.className = 'active';
    locationMessage.style.display = 'block';
  } else {
    locationMessage.textContent = 'Geolocalization is not activated';
    locationMessage.className = 'inactive';
    locationMessage.style.display = 'block';
  }
}

function renderHits(content) {
  if (!content || !content.hits || content.hits.length === 0) {
    resultsContainer.innerHTML = '<div style="grid-column: 1/-1; padding: 4rem; text-align: center; color: #666; font-size: 1.2rem;">No results found for your search.</div>';
    return;
  }

  resultsContainer.innerHTML = content.hits
    .map(hit => {
      const stars = Math.round(hit.stars_count || 0);
      const imageUrl = hit.image_url || 'https://via.placeholder.com/400x300?text=No+Image';
      const reserveUrl = hit.reserve_url || '#';
      
      const starIcons = Array.from({ length: 5 }, (_, i) => `
        <svg class="star-icon" width="16" height="16" viewBox="0 0 24 24" fill="${i < stars ? '#ffb703' : '#ddd'}" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      `).join('');

      return `
        <a href="${reserveUrl}" target="_blank" class="hit-link">
          <div class="hit-card">
            <div class="image-container">
              <img src="${imageUrl}" class="hit-image" alt="${hit.name || 'Restaurant'}">
              <div class="price-tag">${hit.price_range || ''}</div>
            </div>
            <div class="hit-content">
              <div>
                <span class="cuisine-tag">${hit.cuisine_cat || hit.cuisine || 'Restaurant'}</span>
                <div class="hit-name">${hit.name || 'Unnamed Restaurant'}</div>
                <div class="hit-rating">
                  ${starIcons}
                  <span class="review-count">(${hit.reviews_count || 0} reviews)</span>
                </div>
              </div>
              <div class="hit-details">
                ${hit.city || ''}
              </div>
            </div>
          </div>
        </a>
      `;
    })
    .join('');
}

function renderFacets(content) {
  if (!content) return;

  const activeElement = document.activeElement;
  const activeFacet = activeElement && activeElement.classList.contains('facet-search-input') 
    ? activeElement.dataset.facet 
    : null;
  const selectionStart = activeElement ? activeElement.selectionStart : null;

  let facets = [
    { name: 'city', title: 'City', searchable: true },
    { name: 'cuisine_cat', title: 'Cuisine' },
    { name: 'payment_options', title: 'Payment option' },
    { name: 'price_range', title: 'Price range' }
  ];

  // Disable city facet if location is active
  if (state.location) {
    facets = facets.filter(f => f.name !== 'city');
  }

  facetsContainer.innerHTML = facets
    .map(facet => {
      let facetValues = content.getFacetValues(facet.name, { sortBy: ['count:desc'] });
      if (!facetValues || facetValues.length === 0) return '';

      if (facet.name === 'cuisine_cat') {
        const othersIndex = facetValues.findIndex(v => v.name === 'Others');
        if (othersIndex !== -1) {
          const others = facetValues.splice(othersIndex, 1)[0];
          facetValues.push(others);
        }
      }

      const isExpandable = ['city', 'cuisine_cat'].includes(facet.name);
      const isExpanded = state.expandedFacets[facet.name];
      const facetSearchQuery = state.facetSearch[facet.name] || '';

      let filteredValues = facetValues;
      if (facet.searchable && facetSearchQuery) {
        filteredValues = facetValues.filter(v => 
          v.name.toLowerCase().includes(facetSearchQuery.toLowerCase())
        );
      }

      const displayedValues = isExpandable && !isExpanded && !facetSearchQuery
        ? filteredValues.slice(0, 5) 
        : filteredValues;

      return `
        <div class="facet-section">
          <div class="facet-title">${facet.title}</div>
          ${facet.searchable ? `
            <div class="facet-search-container">
              <input type="text" class="facet-search-input" placeholder="Filter ${facet.title}..." 
                data-facet="${facet.name}" value="${facetSearchQuery}">
            </div>
          ` : ''}
          <ul class="facet-list">
            ${displayedValues
              .map(
                v => `
              <li class="facet-item ${v.isRefined ? 'refined' : ''}" data-facet="${facet.name}" data-value="${v.name}">
                <span>${v.name}</span>
                <span class="facet-count">${v.count}</span>
              </li>
            `
              )
              .join('')}
          </ul>
          ${
            isExpandable && filteredValues.length > 5 && !facetSearchQuery
              ? `<button class="show-more" data-facet="${facet.name}">
                  ${isExpanded ? 'Show less' : 'Show more'}
                 </button>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  if (activeFacet) {
    const inputToFocus = facetsContainer.querySelector(`input[data-facet="${activeFacet}"]`);
    if (inputToFocus) {
      inputToFocus.focus();
      inputToFocus.setSelectionRange(selectionStart, selectionStart);
    }
  }
}

function renderPagination(content) {
  const nbPages = content.nbPages;
  if (nbPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  const currentPage = content.page;
  const maxVisiblePages = 5;
  let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(nbPages - 1, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(0, endPage - maxVisiblePages + 1);
  }

  let pagesHtml = '';

  for (let i = startPage; i <= endPage; i++) {
    pagesHtml += `
      <button class="page-link ${i === currentPage ? 'active' : ''}" data-page="${i}">
        ${i + 1}
      </button>
    `;
  }

  paginationContainer.innerHTML = pagesHtml;
}

function renderNextButton(content) {
  const currentPage = content.page;
  const nbPages = content.nbPages;

  if (currentPage < nbPages - 1) {
    nextButtonWrapper.innerHTML = `
      <button class="btn-next" data-page="${currentPage + 1}">Next Page</button>
    `;
  } else {
    nextButtonWrapper.innerHTML = '';
  }
}

// Geolocation logic
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        state.location = `${latitude},${longitude}`;
        helper.setQueryParameter('aroundLatLng', state.location).search();
        
        locationIndicator.classList.add('active');
        locationTooltip.textContent = 'Location Active';
      },
      (error) => {
        console.warn('Geolocation error:', error);
        state.location = null;
        helper.setQueryParameter('aroundLatLng', undefined).search();
        locationIndicator.classList.remove('active');
        locationTooltip.textContent = 'Location Disabled';
      }
    );
  }
}

locationIndicator.addEventListener('click', getUserLocation);

// Event delegation
document.addEventListener('click', (e) => {
  const facetItem = e.target.closest('.facet-item');
  const showMoreBtn = e.target.closest('.show-more');
  const pageLink = e.target.closest('.page-link');
  const nextBtn = e.target.closest('.btn-next');

  if (facetItem) {
    const { facet, value } = facetItem.dataset;
    helper.toggleRefine(facet, value).setPage(0).search();
  } else if (showMoreBtn) {
    const { facet } = showMoreBtn.dataset;
    state.expandedFacets[facet] = !state.expandedFacets[facet];
    renderFacets(helper.lastResults);
  } else if (pageLink || nextBtn) {
    const page = parseInt((pageLink || nextBtn).dataset.page, 10);
    helper.setPage(page).search();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

document.addEventListener('input', (e) => {
  if (e.target.classList.contains('facet-search-input')) {
    const facetName = e.target.dataset.facet;
    state.facetSearch[facetName] = e.target.value;
    renderFacets(helper.lastResults);
  }
});

// Try to get location on load
getUserLocation();

// Initial search
helper.search();
