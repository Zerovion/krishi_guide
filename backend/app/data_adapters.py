"""External public data adapters used by the KrishiGuide API."""
from datetime import datetime, timezone
import os
import requests


def get_weather(district: str) -> dict:
    try:
        geo = requests.get('https://geocoding-api.open-meteo.com/v1/search', params={'name':district,'count':1,'language':'en','format':'json'}, timeout=8).json()
        if not geo.get('results'):
            return {'status':'unavailable','district':district,'message':'District could not be geocoded.'}
        place = geo['results'][0]
        fc = requests.get('https://api.open-meteo.com/v1/forecast', params={'latitude':place['latitude'],'longitude':place['longitude'],'daily':'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max','forecast_days':7,'timezone':'auto'}, timeout=8).json()
        return {'status':'live','district':district,'matched_location':place.get('name'),'admin1':place.get('admin1'),'timezone':fc.get('timezone'),'daily':fc.get('daily'),'fetched_at':datetime.now(timezone.utc).isoformat(),'source':'Open-Meteo'}
    except (requests.RequestException, ValueError, KeyError) as error:
        return {'status':'unavailable','district':district,'message':f'Weather service unavailable: {type(error).__name__}'}


def get_mandi_prices(commodity: str, state: str, district: str | None = None) -> dict:
    key = os.getenv('DATA_GOV_IN_API_KEY')
    if not key:
        return {'status':'unavailable','message':'Set DATA_GOV_IN_API_KEY to enable the official data.gov.in Agmarknet feed. No prices are fabricated.'}
    resource = os.getenv('AGMARKNET_RESOURCE_ID','9ef84268-d588-465a-a308-a864a43d0070')
    params = {'api-key':key,'format':'json','limit':100,'filters[commodity]':commodity,'filters[state]':state}
    if district:
        params['filters[district]'] = district
    try:
        data = requests.get(f'https://api.data.gov.in/resource/{resource}', params=params, timeout=12).json()
        records = data.get('records',[])
        return {'status':'live' if records else 'unavailable','source':'data.gov.in Agmarknet','fetched_at':datetime.now(timezone.utc).isoformat(),'records':records}
    except (requests.RequestException, ValueError):
        return {'status':'unavailable','message':'Official market data request failed.'}
